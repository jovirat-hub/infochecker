# waf_server.py
# WAF Solver Server - Run this as a separate service
# Usage: python waf_server.py

import os
import sys
import subprocess
import tempfile
import logging
import json
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Get port from environment or use default
PORT = int(os.environ.get('PORT', 5001))
HOST = os.environ.get('HOST', '0.0.0.0')

# Solve WAF JS code - embedded for portability
SOLVE_WAF_JS = """const fs = require('fs');
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
"""

def ensure_solve_waf_js():
    """Ensure solve_waf.js exists."""
    script_path = os.path.join(os.path.dirname(__file__), 'solve_waf.js')
    if not os.path.exists(script_path):
        try:
            with open(script_path, 'w', encoding='utf-8') as f:
                f.write(SOLVE_WAF_JS)
            logger.info(f"Created {script_path}")
        except Exception as e:
            logger.error(f"Failed to create solve_waf.js: {e}")
    return script_path

# Ensure the JS file exists
SOLVE_WAF_PATH = ensure_solve_waf_js()

def check_node_available():
    """Check if Node.js is available."""
    try:
        result = subprocess.run(['node', '--version'], capture_output=True, timeout=5)
        return result.returncode == 0
    except Exception:
        return False

NODE_AVAILABLE = check_node_available()

def detect_waf_challenge(html_content):
    """Detect if HTML contains WAF challenge indicators."""
    if not html_content:
        return False
    
    indicators = [
        '<textarea id="renderData"',
        'var arg1=',
        'var _0x',
        'acw_sc__v2',
        'renderData',
        'document.cookie',
        '_acw_sc'
    ]
    
    html_lower = html_content.lower()
    for indicator in indicators:
        if indicator.lower() in html_lower:
            return True
    return False

@app.route('/', methods=['GET', 'POST', 'OPTIONS'])
def solve_waf():
    """
    Endpoint to solve WAF challenges.
    
    POST with JSON: {'html': '...'}
    GET with query param: ?html=...
    
    Returns: {'success': True, 'cookie': 'acw_sc__v2=...', 'token': '...'}
    """
    if request.method == 'OPTIONS':
        return '', 200
    
    try:
        # Get HTML content from request
        if request.method == 'GET':
            html_content = request.args.get('html', '')
        else:
            # Try JSON first, then form data
            data = request.get_json()
            if data:
                html_content = data.get('html', '')
            else:
                html_content = request.form.get('html', '')
        
        if not html_content:
            return jsonify({'success': False, 'error': 'No HTML content provided'}), 400
        
        # Check if it's a WAF challenge
        if not detect_waf_challenge(html_content):
            return jsonify({'success': False, 'error': 'Not a WAF challenge'}), 400
        
        if not NODE_AVAILABLE:
            logger.warning("Node.js not available, WAF solving will fail")
            return jsonify({'success': False, 'error': 'Node.js not installed on server'}), 500
        
        # Create temp file with HTML
        with tempfile.NamedTemporaryFile(mode='w', suffix='.html', delete=False, encoding='utf-8') as f:
            f.write(html_content)
            html_file = f.name
        
        try:
            # Run node script
            result = subprocess.run(
                ['node', SOLVE_WAF_PATH],
                input=html_content,
                capture_output=True,
                text=True,
                timeout=15
            )
            
            # Clean up temp file
            try:
                os.unlink(html_file)
            except:
                pass
            
            # Check for errors
            if result.stderr and 'SOLVE_ERR:' in result.stderr:
                error_msg = result.stderr.strip()
                logger.error(f"WAF solver error: {error_msg}")
                return jsonify({'success': False, 'error': error_msg}), 400
            
            # Parse output
            output = result.stdout.strip()
            if output and output != 'NO_COOKIE':
                logger.info(f"WAF challenge solved successfully")
                return jsonify({
                    'success': True,
                    'cookie': f"acw_sc__v2={output}",
                    'token': output,
                    'timestamp': datetime.now().isoformat()
                })
            
            return jsonify({'success': False, 'error': 'No cookie generated'}), 400
            
        except subprocess.TimeoutExpired:
            logger.error("WAF solver timeout")
            return jsonify({'success': False, 'error': 'Timeout'}), 408
        except Exception as e:
            logger.error(f"Unexpected error in solver: {str(e)}")
            return jsonify({'success': False, 'error': str(e)}), 500
            
    except Exception as e:
        logger.error(f"Server error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/health', methods=['GET', 'OPTIONS'])
def health():
    """Health check endpoint."""
    if request.method == 'OPTIONS':
        return '', 200
    
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'node_available': NODE_AVAILABLE,
        'solver_file_exists': os.path.exists(SOLVE_WAF_PATH)
    })

@app.route('/detect', methods=['POST', 'OPTIONS'])
def detect():
    """Detect if HTML is a WAF challenge."""
    if request.method == 'OPTIONS':
        return '', 200
    
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': 'No data provided'}), 400
        
        html_content = data.get('html', '')
        is_waf = detect_waf_challenge(html_content)
        
        return jsonify({
            'success': True,
            'is_waf_challenge': is_waf
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/stats', methods=['GET'])
def stats():
    """Get solver statistics."""
    return jsonify({
        'status': 'ok',
        'node_available': NODE_AVAILABLE,
        'solver_ready': os.path.exists(SOLVE_WAF_PATH)
    })

@app.errorhandler(404)
def not_found(e):
    return jsonify({'success': False, 'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(e):
    return jsonify({'success': False, 'error': 'Internal server error'}), 500

if __name__ == '__main__':
    print("=" * 60)
    print("WAF SOLVER SERVER")
    print("=" * 60)
    print(f"Host: {HOST}")
    print(f"Port: {PORT}")
    print(f"Node.js available: {NODE_AVAILABLE}")
    print(f"Solver file: {SOLVE_WAF_PATH}")
    print("-" * 60)
    print("Endpoints:")
    print("  POST /          - Solve WAF challenge (json: {'html': '...'})")
    print("  GET /health     - Health check")
    print("  POST /detect    - Detect if HTML is WAF challenge")
    print("  GET /stats      - Server statistics")
    print("=" * 60)
    
    app.run(host=HOST, port=PORT, debug=False, threaded=True)