import os
import json
import tempfile
import subprocess
import asyncio
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

app = FastAPI(title="WAF Solver API", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
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

  let captured = '';
  const location = {
    href: 'https://accountmtapi.mobilelegends.com/',
    reload: () => {},
    get search() { return ''; }
  };
  const documentObj = {
    getElementById: (id) => {
      if (id === 'renderData') return { innerHTML: textareaInner };
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
    navigator: { userAgent: 'Mozilla/5.0' },
    console: console,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    performance: { now: () => Date.now() }
  };
  sandbox.window = sandbox;
  sandbox.top = sandbox;
  sandbox.parent = sandbox;
  sandbox.self = sandbox;

  const ctx = vm.createContext(sandbox);
  const scripts = [...html.matchAll(/<script[^>]*>([\\s\\S]*?)<\\/script>/g)].map((m) => m[1]);
  try {
    for (const s of scripts) {
      vm.runInContext(s, ctx, { timeout: 10000 });
    }
  } catch (e) {
    console.error('SOLVE_ERR:', e.message);
    process.exit(2);
  }
  const m = captured.match(/acw_sc__v2=([^;]+)/);
  console.log(m ? m[1] : 'NO_COOKIE');
});
'''

class WAFSolveRequest(BaseModel):
    html: str

class WAFSolveResponse(BaseModel):
    success: bool
    cookie: str = None
    error: str = None

def create_solve_waf_js(filepath: str):
    """Create the solve_waf.js file if it doesn't exist."""
    if not os.path.exists(filepath):
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(JS_SOLVER_CODE)
        return True
    return False

def solve_waf_challenge(html_content: str, timeout: int = 15) -> str:
    """
    Solve WAF challenge by executing the JavaScript in a Node.js VM.
    
    Args:
        html_content: The HTML content containing the WAF challenge
        timeout: Timeout in seconds
        
    Returns:
        The acw_sc__v2 cookie value or None if failed
    """
    # Create solver script if missing
    script_dir = os.path.dirname(os.path.abspath(__file__))
    solve_waf_path = os.path.join(script_dir, 'solve_waf.js')
    create_solve_waf_js(solve_waf_path)
    
    try:
        result = subprocess.run(
            ['node', solve_waf_path],
            input=html_content,
            capture_output=True,
            text=True,
            timeout=timeout
        )
        
        if result.stderr and 'SOLVE_ERR:' in result.stderr:
            return None
        
        output = result.stdout.strip()
        if output and output != 'NO_COOKIE':
            return output
        
        return None
        
    except subprocess.TimeoutExpired:
        return None
    except FileNotFoundError:
        return None
    except Exception:
        return None


# ================================================================
# FASTAPI ENDPOINTS
# ================================================================

@app.get("/")
async def root():
    return {
        "service": "WAF Solver API",
        "version": "1.0",
        "endpoints": {
            "/solve": "POST - Solve WAF challenge with HTML",
            "/health": "GET - Health check"
        }
    }

@app.get("/health")
async def health():
    return {"status": "healthy"}

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
    
    cookie = solve_waf_challenge(request.html)
    
    if cookie:
        return WAFSolveResponse(success=True, cookie=f"acw_sc__v2={cookie}")
    else:
        return WAFSolveResponse(success=False, error="Failed to solve WAF challenge")

@app.post("/solve-batch")
async def solve_waf_batch(request: dict):
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
    htmls = request.get("htmls", [])
    if not htmls:
        raise HTTPException(status_code=400, detail="htmls array is required")
    
    results = []
    for html_content in htmls:
        cookie = solve_waf_challenge(html_content)
        if cookie:
            results.append({"success": True, "cookie": f"acw_sc__v2={cookie}"})
        else:
            results.append({"success": False, "error": "Failed to solve WAF challenge"})
    
    return {"results": results}


# ================================================================
# DETECT WAF CHALLENGE
# ================================================================

class DetectWAFRequest(BaseModel):
    html: str

@app.post("/detect")
async def detect_waf(request: DetectWAFRequest):
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
        '_acw_sc'
    ]
    
    detected = [indicator for indicator in waf_indicators if indicator in request.html]
    
    return {
        "is_waf": len(detected) > 0,
        "indicators": detected
    }


# ================================================================
# MAIN
# ================================================================

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)
