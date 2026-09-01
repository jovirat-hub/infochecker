import os
import json
import tempfile
import subprocess
import asyncio
import logging
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel, Field
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="WAF Solver API", 
    version="2.0",
    description="Advanced WAF Challenge Solver for Mobile Legends Account Checker API"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

# ================================================================
# WAF SOLVER - solve_waf.js Integration
# ================================================================

JS_SOLVER_CODE = '''const fs = require('fs');
const vm = require('vm');

let html = '';
process.stdin.resume();
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => { html += d; });
process.stdin.on('end', () => {
  const textareaInner = (html.match(/<textarea id="renderData"[^>]*>([\\s\\S]*?)<\\/textarea>/) || [])[1] || '';

  if (!textareaInner) {
    const dm = html.match(/acw_sc__v2\\s*=\\s*['"]([^'"]+)['"]/);
    if (dm) { console.log(dm[1]); return; }
    const dm2 = html.match(/acw_sc__v2=([^;'"\\s&<]+)/);
    if (dm2) { console.log(dm2[1]); return; }
    console.log('NO_COOKIE');
    return;
  }

  let captured = '';
  
  const location = {
    href: 'https://accountmtapi.mobilelegends.com/',
    reload: () => {},
    replace: () => {},
    assign: () => {},
    get search() { return ''; },
    get pathname() { return '/'; },
    get hostname() { return 'accountmtapi.mobilelegends.com'; },
    get host() { return 'accountmtapi.mobilelegends.com'; },
    get origin() { return 'https://accountmtapi.mobilelegends.com'; },
    get protocol() { return 'https:'; },
    get hash() { return ''; }
  };

  const documentObj = {
    getElementById: (id) => {
      if (id === 'renderData') return { innerHTML: textareaInner };
      return null;
    },
    getElementsByTagName: (tag) => {
      return { length: 0 };
    },
    querySelector: (selector) => null,
    querySelectorAll: (selector) => ({ length: 0 }),
    createElement: (tag) => ({ 
      style: {}, 
      appendChild: () => {},
      setAttribute: () => {},
      innerHTML: '',
      innerText: '',
      textContent: ''
    }),
    referrer: '',
    location: location,
    get cookie() { return captured; },
    set cookie(v) { captured = v; },
    domain: 'mobilelegends.com',
    readyState: 'complete',
    addEventListener: () => {},
    removeEventListener: () => {},
    getElementsByClassName: () => ({ length: 0 }),
    getElementsByName: () => ({ length: 0 }),
    createTextNode: () => ({}),
    createDocumentFragment: () => ({}),
    body: {
      appendChild: () => {},
      style: {}
    },
    head: {
      appendChild: () => {}
    }
  };

  const sandbox = {
    document: documentObj,
    location: location,
    navigator: { 
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      appName: 'Netscape',
      appVersion: '5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      platform: 'Win32',
      language: 'en-US',
      cookieEnabled: true,
      doNotTrack: null,
      plugins: { length: 0 },
      mimeTypes: { length: 0 }
    },
    console: console,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    setInterval: setInterval,
    clearInterval: clearInterval,
    performance: { 
      now: () => Date.now(),
      timing: {
        navigationStart: Date.now() - 1000,
        unloadEventStart: 0,
        unloadEventEnd: 0,
        redirectStart: 0,
        redirectEnd: 0,
        fetchStart: Date.now() - 500,
        domainLookupStart: Date.now() - 400,
        domainLookupEnd: Date.now() - 300,
        connectStart: Date.now() - 200,
        connectEnd: Date.now() - 150,
        secureConnectionStart: Date.now() - 180,
        requestStart: Date.now() - 100,
        responseStart: Date.now() - 50,
        responseEnd: Date.now(),
        domLoading: Date.now() - 10,
        domInteractive: Date.now(),
        domContentLoadedEventStart: Date.now(),
        domContentLoadedEventEnd: Date.now(),
        domComplete: Date.now(),
        loadEventStart: Date.now(),
        loadEventEnd: Date.now()
      },
      memory: {
        jsHeapSizeLimit: 1000000000,
        totalJSHeapSize: 1000000,
        usedJSHeapSize: 500000
      }
    },
    Date: Date,
    Math: Math,
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
    atob: atob,
    btoa: btoa,
    Error: Error,
    TypeError: TypeError,
    ReferenceError: ReferenceError,
    SyntaxError: SyntaxError,
    RangeError: RangeError,
    URIError: URIError,
    EvalError: EvalError,
    Array: Array,
    Object: Object,
    String: String,
    Number: Number,
    Boolean: Boolean,
    Function: Function,
    RegExp: RegExp,
    Map: Map,
    Set: Set,
    WeakMap: WeakMap,
    WeakSet: WeakSet,
    Promise: Promise,
    Symbol: Symbol,
    crypto: {
      getRandomValues: (array) => {
        for (let i = 0; i < array.length; i++) {
          array[i] = Math.floor(Math.random() * 256);
        }
        return array;
      },
      subtle: {}
    },
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
    XMLHttpRequest: function() {
      const self = this;
      this.readyState = 0;
      this.status = 0;
      this.responseText = '';
      this.response = '';
      this.responseType = '';
      this.timeout = 0;
      this.withCredentials = false;
      this.upload = {};
      this.onreadystatechange = null;
      this.onload = null;
      this.onerror = null;
      this.onprogress = null;
      this.onabort = null;
      
      this.open = (method, url, async) => {
        self.readyState = 1;
      };
      this.send = (data) => {
        self.readyState = 4;
        self.status = 200;
        self.responseText = '';
        self.response = '';
        if (self.onreadystatechange) self.onreadystatechange();
        if (self.onload) self.onload();
      };
      this.setRequestHeader = () => {};
      this.abort = () => {
        if (this.onabort) this.onabort();
      };
      this.getAllResponseHeaders = () => '';
      this.getResponseHeader = (header) => null;
      this.overrideMimeType = () => {};
      this.addEventListener = () => {};
      this.removeEventListener = () => {};
    },
    fetch: (url, options) => {
      return new Promise((resolve) => {
        resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: new Map(),
          json: () => Promise.resolve({}),
          text: () => Promise.resolve(''),
          blob: () => Promise.resolve(new Blob()),
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
          clone: () => this
        });
      });
    },
    screen: {
      width: 1920,
      height: 1080,
      availWidth: 1920,
      availHeight: 1040,
      colorDepth: 24,
      pixelDepth: 24,
      orientation: {
        type: 'landscape-primary',
        angle: 0
      }
    },
    history: {
      length: 1,
      state: null,
      scrollRestoration: 'auto',
      back: () => {},
      forward: () => {},
      go: () => {},
      pushState: () => {},
      replaceState: () => {}
    },
    requestAnimationFrame: (cb) => setTimeout(cb, 16),
    cancelAnimationFrame: (id) => clearTimeout(id),
    requestIdleCallback: (cb) => setTimeout(cb, 50),
    cancelIdleCallback: (id) => clearTimeout(id),
    URL: URL,
    URLSearchParams: URLSearchParams,
    Blob: Blob,
    File: File,
    FileReader: FileReader,
    FormData: FormData,
    DOMParser: DOMParser,
    XMLSerializer: XMLSerializer,
    Event: Event,
    CustomEvent: CustomEvent,
    MouseEvent: MouseEvent,
    KeyboardEvent: KeyboardEvent,
    self: null,
    frames: null,
    parent: null,
    top: null,
    window: null,
    globalThis: null,
    opener: null,
    innerWidth: 1920,
    innerHeight: 1080,
    outerWidth: 1920,
    outerHeight: 1080,
    pageXOffset: 0,
    pageYOffset: 0,
    scrollX: 0,
    scrollY: 0,
    devicePixelRatio: 1,
    name: '',
    closed: false,
    length: 0,
    eval: (code) => {
      try {
        return vm.runInContext(code, ctx, { timeout: 1000 });
      } catch (e) {
        return undefined;
      }
    }
  };
  
  sandbox.window = sandbox;
  sandbox.top = sandbox;
  sandbox.parent = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.frames = sandbox;

  const ctx = vm.createContext(sandbox);
  const scripts = [...html.matchAll(/<script[^>]*>([\\s\\S]*?)<\\/script>/g)].map((m) => m[1]);
  let foundCookie = false;
  
  try {
    for (const s of scripts) {
      if (foundCookie) break;
      try {
        vm.runInContext(s, ctx, { timeout: 5000 });
        if (captured) {
          const m = captured.match(/acw_sc__v2=([^;]+)/);
          if (m) {
            console.log(m[1]);
            foundCookie = true;
            break;
          }
        }
      } catch (e) {}
    }
    
    if (!foundCookie && captured) {
      const m = captured.match(/acw_sc__v2=([^;]+)/);
      if (m) {
        console.log(m[1]);
        foundCookie = true;
      }
    }
    
    if (!foundCookie) {
      const dm = html.match(/acw_sc__v2=([^;'"\\s&<]+)/);
      if (dm) {
        console.log(dm[1]);
        foundCookie = true;
      }
    }
    
    if (!foundCookie) {
      console.log('NO_COOKIE');
    }
    
  } catch (e) {
    console.error('SOLVE_ERR:', e.message);
    process.exit(2);
  }
});'''

# ================================================================
# MODELS
# ================================================================

class WAFSolveRequest(BaseModel):
    html: str = Field(..., description="HTML content containing the WAF challenge")

class WAFSolveResponse(BaseModel):
    success: bool
    cookie: Optional[str] = None
    error: Optional[str] = None

class WAFBatchRequest(BaseModel):
    htmls: List[str] = Field(..., description="List of HTML contents to solve")

class WAFBatchResponse(BaseModel):
    results: List[Dict[str, Any]]

class WAFDetectRequest(BaseModel):
    html: str = Field(..., description="HTML content to check for WAF")

class WAFDetectResponse(BaseModel):
    is_waf: bool
    indicators: List[str]

class WAFStatsResponse(BaseModel):
    total_solves: int
    success_rate: float
    average_time_ms: float

# ================================================================
# CORE SOLVER
# ================================================================

class WAFSolver:
    def __init__(self):
        self.solve_waf_path = None
        self.stats = {
            'total_solves': 0,
            'successful_solves': 0,
            'total_time': 0
        }
        self._initialize_solver()
    
    def _initialize_solver(self):
        """Create the solve_waf.js file if it doesn't exist."""
        script_dir = os.path.dirname(os.path.abspath(__file__))
        self.solve_waf_path = os.path.join(script_dir, 'solve_waf.js')
        
        if not os.path.exists(self.solve_waf_path):
            logger.info(f"Creating solve_waf.js at {self.solve_waf_path}")
            with open(self.solve_waf_path, 'w', encoding='utf-8') as f:
                f.write(JS_SOLVER_CODE)
            return True
        return False
    
    def solve(self, html_content: str, timeout: int = 15) -> Optional[str]:
        """
        Solve WAF challenge by executing the JavaScript in a Node.js VM.
        
        Args:
            html_content: The HTML content containing the WAF challenge
            timeout: Timeout in seconds
            
        Returns:
            The acw_sc__v2 cookie value or None if failed
        """
        import time
        start_time = time.time()
        
        try:
            result = subprocess.run(
                ['node', self.solve_waf_path],
                input=html_content,
                capture_output=True,
                text=True,
                timeout=timeout
            )
            
            # Update stats
            elapsed = (time.time() - start_time) * 1000  # Convert to ms
            self.stats['total_solves'] += 1
            self.stats['total_time'] += elapsed
            
            if result.stderr and 'SOLVE_ERR:' in result.stderr:
                logger.error(f"Solver error: {result.stderr}")
                return None
            
            output = result.stdout.strip()
            if output and output != 'NO_COOKIE':
                self.stats['successful_solves'] += 1
                return output
            
            return None
            
        except subprocess.TimeoutExpired:
            elapsed = (time.time() - start_time) * 1000
            self.stats['total_solves'] += 1
            self.stats['total_time'] += elapsed
            logger.error(f"Solver timeout after {timeout}s")
            return None
        except FileNotFoundError:
            logger.error("Node.js not found. Please install Node.js.")
            return None
        except Exception as e:
            elapsed = (time.time() - start_time) * 1000
            self.stats['total_solves'] += 1
            self.stats['total_time'] += elapsed
            logger.error(f"Solver error: {str(e)}")
            return None
    
    def get_stats(self) -> Dict[str, Any]:
        """Get solver statistics."""
        total = self.stats['total_solves']
        successful = self.stats['successful_solves']
        total_time = self.stats['total_time']
        
        return {
            'total_solves': total,
            'successful_solves': successful,
            'success_rate': (successful / total * 100) if total > 0 else 0.0,
            'average_time_ms': (total_time / total) if total > 0 else 0.0
        }

# Initialize the solver
solver = WAFSolver()

# ================================================================
# FASTAPI ENDPOINTS
# ================================================================

@app.get("/")
async def root():
    return {
        "service": "WAF Solver API",
        "version": "2.0",
        "description": "Advanced WAF Challenge Solver for Mobile Legends",
        "endpoints": {
            "/solve": "POST - Solve WAF challenge with HTML",
            "/solve-batch": "POST - Solve multiple WAF challenges",
            "/detect": "POST - Detect if HTML contains WAF",
            "/stats": "GET - Get solver statistics",
            "/health": "GET - Health check"
        }
    }

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "node_available": os.system("node --version > /dev/null 2>&1") == 0
    }

@app.get("/stats", response_model=WAFStatsResponse)
async def get_stats():
    """Get solver statistics."""
    stats = solver.get_stats()
    return WAFStatsResponse(**stats)

@app.post("/solve", response_model=WAFSolveResponse)
async def solve_waf(request: WAFSolveRequest):
    """
    Solve a WAF challenge by executing the JavaScript in a Node.js VM.
    
    Request body:
    {
        "html": "<html>...</html>"
    }
    
    Response:
    {
        "success": true,
        "cookie": "acw_sc__v2=...",
        "error": null
    }
    """
    if not request.html:
        raise HTTPException(status_code=400, detail="HTML content is required")
    
    if len(request.html) > 10 * 1024 * 1024:  # 10MB limit
        raise HTTPException(status_code=400, detail="HTML content too large (max 10MB)")
    
    cookie = solver.solve(request.html)
    
    if cookie:
        return WAFSolveResponse(success=True, cookie=f"acw_sc__v2={cookie}")
    else:
        return WAFSolveResponse(success=False, error="Failed to solve WAF challenge")

@app.post("/solve-batch", response_model=WAFBatchResponse)
async def solve_waf_batch(request: WAFBatchRequest):
    """
    Solve multiple WAF challenges in batch.
    
    Request body:
    {
        "htmls": ["<html>...</html>", "<html>...</html>"]
    }
    
    Response:
    {
        "results": [
            {"success": true, "cookie": "acw_sc__v2=..."},
            {"success": false, "error": "..."}
        ]
    }
    """
    if not request.htmls:
        raise HTTPException(status_code=400, detail="htmls array is required")
    
    if len(request.htmls) > 100:
        raise HTTPException(status_code=400, detail="Maximum 100 items per batch")
    
    results = []
    for html_content in request.htmls:
        if len(html_content) > 10 * 1024 * 1024:
            results.append({
                "success": False, 
                "error": "HTML content too large (max 10MB)"
            })
            continue
            
        cookie = solver.solve(html_content)
        if cookie:
            results.append({"success": True, "cookie": f"acw_sc__v2={cookie}"})
        else:
            results.append({"success": False, "error": "Failed to solve WAF challenge"})
    
    return WAFBatchResponse(results=results)

@app.post("/detect", response_model=WAFDetectResponse)
async def detect_waf(request: WAFDetectRequest):
    """
    Detect if the HTML contains a WAF challenge.
    
    Request body:
    {
        "html": "<html>...</html>"
    }
    
    Response:
    {
        "is_waf": true,
        "indicators": ["<textarea id=\"renderData\"", "var arg1="]
    }
    """
    if not request.html:
        raise HTTPException(status_code=400, detail="HTML content is required")
    
    waf_indicators = [
        '<textarea id="renderData"',
        'var arg1=',
        'var _0x',
        'acw_sc__v2',
        'renderData',
        'document.cookie',
        '_acw_sc',
        'acw_sc__v2=',
        'eval(function',
        'atob(',
        'window.acw_sc__v2'
    ]
    
    detected = [indicator for indicator in waf_indicators if indicator in request.html]
    
    return WAFDetectResponse(
        is_waf=len(detected) > 0,
        indicators=detected
    )

# ================================================================
# EXCEPTION HANDLING
# ================================================================

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": exc.detail,
            "status_code": exc.status_code
        }
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": "Internal server error",
            "status_code": 500
        }
    )

# ================================================================
# MAIN
# ================================================================

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    host = os.environ.get("HOST", "0.0.0.0")
    
    logger.info(f"Starting WAF Solver API on {host}:{port}")
    logger.info(f"Node.js available: {os.system('node --version > /dev/null 2>&1') == 0}")
    
    uvicorn.run(
        app, 
        host=host, 
        port=port,
        log_level="info",
        access_log=True
    )
