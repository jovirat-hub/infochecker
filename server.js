const express = require('express');
const vm = require('vm');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.text({ limit: '10mb', type: 'text/html' }));

// Logging
const log = (msg) => {
    console.log(`[${new Date().toISOString()}] ${msg}`);
};

/**
 * Solve WAF challenge from HTML content
 */
function solveWafChallenge(htmlContent) {
    try {
        // Extract renderData from textarea
        const textareaMatch = htmlContent.match(/<textarea id="renderData"[^>]*>([\s\S]*?)<\/textarea>/);
        const textareaInner = textareaMatch ? textareaMatch[1] : '';

        let captured = '';
        
        // Create mock browser environment
        const location = {
            href: 'https://accountmtapi.mobilelegends.com/',
            reload: () => {},
            get search() { return ''; }
        };
        
        const documentObj = {
            getElementById: (id) => {
                if (id === 'renderData') {
                    return { innerHTML: textareaInner };
                }
                return null;
            },
            referrer: '',
            location: location,
            get cookie() { return captured; },
            set cookie(v) { captured = v; }
        };
        
        const sandbox = {
            document: documentObj,
            location: location,
            navigator: { 
                userAgent: 'Mozilla/5.0 (Linux; Android 16; CPH2603) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Mobile Safari/537.36' 
            },
            console: console,
            setTimeout: setTimeout,
            clearTimeout: clearTimeout,
            clearInterval: clearInterval,
            setInterval: setInterval,
            performance: { now: () => Date.now() },
            Math: Math,
            Date: Date,
            String: String,
            Number: Number,
            Boolean: Boolean,
            Array: Array,
            Object: Object,
            JSON: JSON,
            parseInt: parseInt,
            parseFloat: parseFloat,
            isNaN: isNaN,
            isFinite: isFinite,
            encodeURI: encodeURI,
            decodeURI: decodeURI,
            encodeURIComponent: encodeURIComponent,
            decodeURIComponent: decodeURIComponent,
            escape: escape,
            unescape: unescape,
            Error: Error,
            TypeError: TypeError,
            RangeError: RangeError,
            ReferenceError: ReferenceError,
            SyntaxError: SyntaxError,
            EvalError: EvalError,
            URIError: URIError,
            // Additional browser globals
            screen: { width: 1920, height: 1080 },
            navigator: { 
                userAgent: 'Mozilla/5.0 (Linux; Android 16; CPH2603) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Mobile Safari/537.36',
                platform: 'Linux armv8l',
                language: 'en-US',
                languages: ['en-US', 'en'],
                cookieEnabled: true,
                doNotTrack: null
            },
            localStorage: {
                getItem: () => null,
                setItem: () => {},
                removeItem: () => {},
                clear: () => {}
            },
            sessionStorage: {
                getItem: () => null,
                setItem: () => {},
                removeItem: () => {},
                clear: () => {}
            }
        };
        
        sandbox.window = sandbox;
        sandbox.top = sandbox;
        sandbox.parent = sandbox;
        sandbox.self = sandbox;
        sandbox.global = sandbox;
        sandbox.globalThis = sandbox;

        const ctx = vm.createContext(sandbox);
        
        // Extract and run scripts
        const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/g;
        const scripts = [];
        let match;
        while ((match = scriptRegex.exec(htmlContent)) !== null) {
            scripts.push(match[1]);
        }

        // First, try to find and execute the WAF script specifically
        let wafScript = null;
        for (const script of scripts) {
            if (script.includes('var arg1=') || 
                script.includes('acw_sc__v2') || 
                script.includes('_acw_sc')) {
                wafScript = script;
                break;
            }
        }

        // Run all scripts with timeout
        for (const s of scripts) {
            try {
                // Skip scripts that are too large or might hang
                if (s.length > 1000000) {
                    log('Skipping large script (>1MB)');
                    continue;
                }
                
                // Add safety wrapper for potentially problematic scripts
                const wrappedScript = `
                    try {
                        ${s}
                    } catch(e) {
                        // Silently continue
                    }
                `;
                vm.runInContext(wrappedScript, ctx, { timeout: 5000 });
            } catch (e) {
                // Continue execution - many errors are expected in VM environment
                if (!e.message.includes('timeout')) {
                    log(`Script execution warning: ${e.message}`);
                }
            }
        }

        // Extract cookie from captured variable or from context
        let cookieValue = captured;
        
        // Also check for acw_sc__v2 in the context's document.cookie
        if (!cookieValue) {
            try {
                const docCookie = vm.runInContext('document.cookie', ctx);
                if (docCookie) {
                    cookieValue = docCookie;
                }
            } catch (e) {}
        }

        // Try to extract acw_sc__v2 from cookie
        const acwMatch = cookieValue.match(/acw_sc__v2=([^;]+)/);
        if (acwMatch) {
            return acwMatch[1];
        }

        // If not found in cookie, try to find it in variables
        try {
            const possibleVars = ['acw_sc__v2', 'arg1', 'result', 'cookie', 'token'];
            for (const varName of possibleVars) {
                try {
                    const val = vm.runInContext(`typeof ${varName} !== 'undefined' ? ${varName} : null`, ctx);
                    if (val && typeof val === 'string' && val.length > 10) {
                        return val;
                    }
                } catch (e) {}
            }
        } catch (e) {}

        return null;
    } catch (e) {
        log(`Error solving WAF: ${e.message}`);
        return null;
    }
}

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

/**
 * Main WAF solve endpoint
 */
app.post('/solve', (req, res) => {
    const startTime = Date.now();
    
    try {
        const html = typeof req.body === 'string' ? req.body : req.body.html || req.body.content || '';
        
        if (!html || html.length < 100) {
            return res.status(400).json({
                success: false,
                error: 'Invalid HTML content provided',
                message: 'HTML content too short or missing'
            });
        }

        // Check if this looks like a WAF challenge
        const isWaf = html.includes('renderData') || 
                      html.includes('acw_sc__v2') || 
                      html.includes('_acw_sc') ||
                      html.includes('arg1=');
        
        if (!isWaf) {
            return res.status(200).json({
                success: false,
                error: 'Not a WAF challenge page',
                message: 'The provided HTML does not appear to be a WAF challenge'
            });
        }

        log(`Solving WAF challenge (${html.length} bytes)`);
        
        const token = solveWafChallenge(html);
        const elapsed = Date.now() - startTime;
        
        if (token) {
            log(`Successfully solved WAF in ${elapsed}ms`);
            return res.json({
                success: true,
                token: token,
                cookie: `acw_sc__v2=${token}`,
                elapsed: elapsed,
                timestamp: new Date().toISOString()
            });
        } else {
            log(`Failed to solve WAF challenge in ${elapsed}ms`);
            return res.status(200).json({
                success: false,
                error: 'Failed to extract WAF token',
                message: 'Could not find acw_sc__v2 cookie value after executing scripts',
                elapsed: elapsed
            });
        }
    } catch (error) {
        log(`Error in /solve endpoint: ${error.message}`);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

/**
 * Batch solve endpoint
 */
app.post('/solve-batch', async (req, res) => {
    const startTime = Date.now();
    
    try {
        const { challenges } = req.body;
        
        if (!challenges || !Array.isArray(challenges) || challenges.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid input',
                message: 'challenges array is required'
            });
        }

        if (challenges.length > 50) {
            return res.status(400).json({
                success: false,
                error: 'Too many challenges',
                message: 'Maximum 50 challenges per batch request'
            });
        }

        const results = challenges.map((html, index) => {
            try {
                const token = solveWafChallenge(html);
                return {
                    index,
                    success: !!token,
                    token: token || null,
                    cookie: token ? `acw_sc__v2=${token}` : null
                };
            } catch (e) {
                return {
                    index,
                    success: false,
                    error: e.message,
                    token: null
                };
            }
        });

        const elapsed = Date.now() - startTime;
        const successful = results.filter(r => r.success).length;

        log(`Batch solve: ${successful}/${challenges.length} successful in ${elapsed}ms`);

        return res.json({
            success: true,
            results: results,
            summary: {
                total: challenges.length,
                successful: successful,
                failed: challenges.length - successful,
                elapsed: elapsed
            }
        });
    } catch (error) {
        log(`Error in /solve-batch: ${error.message}`);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
});

/**
 * Status endpoint
 */
app.get('/status', (req, res) => {
    res.json({
        status: 'running',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        node_version: process.version,
        platform: process.platform,
        timestamp: new Date().toISOString()
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    log(`Unhandled error: ${err.message}`);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: err.message
    });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    log(`WAF Solver Server running on port ${PORT}`);
    log(`Environment: ${process.env.NODE_ENV || 'production'}`);
    log(`Memory limit: ${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    log('Received SIGTERM, shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    log('Received SIGINT, shutting down gracefully...');
    process.exit(0);
});
