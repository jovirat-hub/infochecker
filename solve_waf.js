const fs = require('fs');
const vm = require('vm');
const crypto = require('crypto');

/**
 * Enhanced WAF Solver for MLBB Account Checker
 * Extracts acw_sc__v2 cookie from Cloudflare-style challenges
 */
function solveWaf(html) {
    let captured = '';
    let acwCookie = null;
    
    // Extract from textarea
    const textareaInner = (html.match(/<textarea id="renderData"[^>]*>([\s\S]*?)<\/textarea>/) || [])[1] || '';
    
    // If no textarea, try direct extraction
    if (!textareaInner) {
        // Try multiple patterns
        const patterns = [
            /acw_sc__v2\s*=\s*['"]([^'"]+)['"]/,
            /acw_sc__v2=([^;'"\s&<]+)/,
            /cookie\s*=\s*['"]acw_sc__v2=([^'"]+)['"]/,
            /["']acw_sc__v2["']\s*:\s*["']([^"']+)["']/,
            /acw_sc__v2['"]?\s*:\s*['"]([^'"]+)['"]/
        ];
        
        for (const pattern of patterns) {
            const match = html.match(pattern);
            if (match) {
                return match[1];
            }
        }
        
        // Try to find in script tags
        const scriptMatches = html.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
        for (const script of scriptMatches) {
            for (const pattern of patterns) {
                const match = script.match(pattern);
                if (match) {
                    return match[1];
                }
            }
        }
        
        return null;
    }

    // Setup enhanced browser sandbox
    const location = {
        href: 'https://accountmtapi.mobilelegends.com/',
        reload: () => {},
        get search() { return ''; },
        get hostname() { return 'accountmtapi.mobilelegends.com'; },
        get origin() { return 'https://accountmtapi.mobilelegends.com'; },
        get protocol() { return 'https:'; },
        get pathname() { return '/'; },
        get hash() { return ''; },
        get port() { return ''; },
        assign: () => {},
        replace: () => {}
    };
    
    const documentObj = {
        getElementById: (id) => {
            if (id === 'renderData') {
                return { 
                    innerHTML: textareaInner,
                    textContent: textareaInner,
                    innerText: textareaInner
                };
            }
            return null;
        },
        getElementsByTagName: (tag) => {
            if (tag === 'script') {
                const scripts = html.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
                return scripts.map(s => ({ 
                    innerHTML: s,
                    textContent: s,
                    parentNode: { removeChild: () => {} }
                }));
            }
            return [];
        },
        getElementsByName: () => [],
        getElementsByClassName: () => [],
        querySelector: () => null,
        querySelectorAll: () => [],
        referrer: '',
        location: location,
        get cookie() { return captured; },
        set cookie(v) { 
            captured = v;
            // Extract acw_sc__v2 from cookie string
            const match = v.match(/acw_sc__v2=([^;]+)/);
            if (match) {
                acwCookie = match[1];
                captured = match[1]; // Store just the value
            }
        },
        createElement: (tag) => {
            return {
                innerHTML: '',
                textContent: '',
                setAttribute: () => {},
                appendChild: () => {},
                style: {},
                parentNode: { removeChild: () => {} },
                getElementsByTagName: () => [],
                getElementById: () => null,
                querySelector: () => null,
                querySelectorAll: () => []
            };
        },
        createTextNode: () => ({}),
        createComment: () => ({}),
        body: { 
            appendChild: () => {},
            getElementsByTagName: () => [],
            querySelector: () => null
        },
        head: { 
            appendChild: () => {},
            getElementsByTagName: () => [],
            querySelector: () => null
        },
        documentElement: {
            getElementsByTagName: () => [],
            querySelector: () => null
        },
        domain: 'accountmtapi.mobilelegends.com',
        cookie: '',
        readyState: 'complete',
        hidden: false,
        visibilityState: 'visible'
    };
    
    // Enhanced sandbox with complete browser APIs
    const sandbox = {
        document: documentObj,
        location: location,
        navigator: { 
            userAgent: 'Mozilla/5.0 (Linux; Android 16; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Mobile Safari/537.36',
            platform: 'Linux armv8l',
            language: 'en-US',
            languages: ['en-US', 'en'],
            cookieEnabled: true,
            doNotTrack: null,
            hardwareConcurrency: 8,
            maxTouchPoints: 10,
            appVersion: '5.0 (Linux; Android 16) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Mobile Safari/537.36',
            appName: 'Netscape',
            product: 'Gecko',
            vendor: 'Google Inc.',
            vendorSub: '',
            productSub: '20030107',
            userAgentData: {
                brands: [
                    { brand: 'Chromium', version: '120' },
                    { brand: 'Google Chrome', version: '120' },
                    { brand: 'Not?A_Brand', version: '24' }
                ],
                mobile: true,
                platform: 'Android',
                getHighEntropyValues: () => Promise.resolve({})
            }
        },
        console: console,
        setTimeout: setTimeout,
        clearTimeout: clearTimeout,
        setInterval: setInterval,
        clearInterval: clearInterval,
        setImmediate: setImmediate,
        clearImmediate: clearImmediate,
        performance: { 
            now: () => Date.now(),
            timing: {
                navigationStart: Date.now() - 1000,
                responseStart: Date.now() - 500,
                domComplete: Date.now(),
                loadEventEnd: Date.now(),
                loadEventStart: Date.now() - 100
            }
        },
        Date: Date,
        Math: Math,
        JSON: JSON,
        parseInt: parseInt,
        parseFloat: parseFloat,
        isNaN: isNaN,
        isFinite: isFinite,
        encodeURIComponent: encodeURIComponent,
        decodeURIComponent: decodeURIComponent,
        encodeURI: encodeURI,
        decodeURI: decodeURI,
        escape: escape,
        unescape: unescape,
        atob: atob,
        btoa: btoa,
        crypto: {
            getRandomValues: (array) => {
                for (let i = 0; i < array.length; i++) {
                    array[i] = Math.floor(Math.random() * 256);
                }
                return array;
            },
            randomUUID: () => {
                return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                    const r = Math.random() * 16 | 0;
                    const v = c === 'x' ? r : (r & 0x3 | 0x8);
                    return v.toString(16);
                });
            },
            subtle: {
                digest: () => Promise.resolve(new ArrayBuffer(32))
            }
        },
        // Additional browser APIs
        localStorage: {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
            clear: () => {},
            key: () => null,
            length: 0
        },
        sessionStorage: {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
            clear: () => {},
            key: () => null,
            length: 0
        },
        history: {
            pushState: () => {},
            replaceState: () => {},
            back: () => {},
            forward: () => {},
            go: () => {},
            length: 1,
            state: null
        },
        screen: {
            width: 1080,
            height: 2400,
            availWidth: 1080,
            availHeight: 2400,
            colorDepth: 24,
            pixelDepth: 24,
            orientation: {
                type: 'portrait-primary',
                angle: 0
            }
        },
        innerWidth: 1080,
        innerHeight: 2400,
        outerWidth: 1080,
        outerHeight: 2400,
        screenX: 0,
        screenY: 0,
        pageXOffset: 0,
        pageYOffset: 0,
        scrollX: 0,
        scrollY: 0,
        devicePixelRatio: 3,
        matchMedia: () => ({
            matches: false,
            media: '',
            onchange: null,
            addListener: () => {},
            removeListener: () => {},
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => {}
        }),
        requestAnimationFrame: (callback) => setTimeout(callback, 16),
        cancelAnimationFrame: clearTimeout,
        requestIdleCallback: (callback) => setTimeout(callback, 100),
        cancelIdleCallback: clearTimeout,
        // Common libraries
        jQuery: null,
        $: null,
        // XMLHttpRequest mock
        XMLHttpRequest: class {
            constructor() {
                this.readyState = 0;
                this.status = 0;
                this.responseText = '';
                this.responseXML = null;
                this.onreadystatechange = null;
                this.onload = null;
                this.onerror = null;
            }
            open() {}
            send() {}
            setRequestHeader() {}
            getResponseHeader() { return null; }
            getAllResponseHeaders() { return ''; }
            abort() {}
        },
        // Fetch API mock
        fetch: () => Promise.resolve({
            ok: true,
            status: 200,
            statusText: 'OK',
            headers: { get: () => null },
            json: () => Promise.resolve({}),
            text: () => Promise.resolve(''),
            blob: () => Promise.resolve(new Blob()),
            arrayBuffer: () => Promise.resolve(new ArrayBuffer(0))
        }),
        // Promise
        Promise: Promise,
        // Other globals
        undefined: undefined,
        NaN: NaN,
        Infinity: Infinity
    };
    
    // Set circular references
    sandbox.window = sandbox;
    sandbox.top = sandbox;
    sandbox.parent = sandbox;
    sandbox.self = sandbox;
    sandbox.globalThis = sandbox;
    sandbox.window.window = sandbox;
    
    const ctx = vm.createContext(sandbox);
    
    // Extract and execute all scripts with enhanced handling
    const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    
    try {
        for (const s of scripts) {
            // Skip empty scripts
            if (!s || s.trim().length === 0) continue;
            
            try {
                // Wrap script to handle errors gracefully
                const wrappedScript = `
                    (function() {
                        try {
                            ${s}
                        } catch(e) {
                            // Script execution error - continue
                        }
                    })();
                `;
                vm.runInContext(wrappedScript, ctx, { timeout: 8000 });
            } catch (e) {
                // Continue to next script
            }
        }
    } catch (e) {
        // Timeout or other error - continue with extraction
    }
    
    // Check if we captured the cookie during execution
    if (acwCookie) {
        return acwCookie;
    }
    
    // Extract from captured cookie string
    if (captured) {
        const match = captured.match(/acw_sc__v2=([^;]+)/);
        if (match) return match[1];
        // If captured is just the value
        if (captured.startsWith('CN31_') || captured.length > 20) {
            return captured;
        }
    }
    
    // Try to extract from any document.cookie assignments in HTML
    const cookieAssignments = html.match(/document\.cookie\s*=\s*['"]([^'"]+)['"]/g) || [];
    for (const assignment of cookieAssignments) {
        const match = assignment.match(/acw_sc__v2=([^;]+)/);
        if (match) return match[1];
    }
    
    // Last resort: try to find in the remaining HTML
    const patterns = [
        /acw_sc__v2["']?\s*:\s*["']([^"']+)["']/,
        /['"]acw_sc__v2['"]\s*\+\s*=['"]([^'"]+)['"]/,
        /acw_sc__v2\s*=\s*['"]([^'"]+)['"]/,
        /['"]acw_sc__v2['"]\s*,\s*['"]([^'"]+)['"]/
    ];
    
    for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match) return match[1];
    }
    
    return null;
}

// Main execution
let html = '';
process.stdin.resume();
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => { html += d; });
process.stdin.on('end', () => {
    const result = solveWaf(html);
    console.log(result || 'NO_COOKIE');
});
