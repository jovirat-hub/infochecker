const fs = require('fs');
const vm = require('vm');

let html = '';
process.stdin.resume();
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => { html += d; });
process.stdin.on('end', () => {
  // Get the textarea content - the challenge data
  const textareaInner = (html.match(/<textarea id="renderData"[^>]*>([\s\S]*?)<\/textarea>/) || [])[1] || '';

  if (!textareaInner) {
    // Try to extract acw_sc__v2 directly from HTML if no textarea
    const dm = html.match(/acw_sc__v2\s*=\s*['"]([^'"]+)['"]/);
    if (dm) { console.log(dm[1]); return; }
    const dm2 = html.match(/acw_sc__v2=([^;'"\s&<]+)/);
    if (dm2) { console.log(dm2[1]); return; }
    console.log('NO_COOKIE');
    return;
  }

  let captured = '';
  
  // Enhanced location object
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

  // Enhanced document object with more DOM methods
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

  // Complete sandbox with all necessary browser globals
  const sandbox = {
    // Core objects
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
    
    // Timing functions
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    setInterval: setInterval,
    clearInterval: clearInterval,
    
    // Performance
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
    
    // Standard globals
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
    
    // Error handling
    Error: Error,
    TypeError: TypeError,
    ReferenceError: ReferenceError,
    SyntaxError: SyntaxError,
    RangeError: RangeError,
    URIError: URIError,
    EvalError: EvalError,
    
    // Core constructors
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
    
    // Browser APIs
    crypto: {
      getRandomValues: (array) => {
        for (let i = 0; i < array.length; i++) {
          array[i] = Math.floor(Math.random() * 256);
        }
        return array;
      },
      subtle: {}
    },
    
    // Storage
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
    
    // XHR
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
    
    // Fetch API
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
    
    // Other browser globals
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
    
    // Animation
    requestAnimationFrame: (cb) => setTimeout(cb, 16),
    cancelAnimationFrame: (id) => clearTimeout(id),
    requestIdleCallback: (cb) => setTimeout(cb, 50),
    cancelIdleCallback: (id) => clearTimeout(id),
    
    // Additional utilities
    URL: URL,
    URLSearchParams: URLSearchParams,
    Blob: Blob,
    File: File,
    FileReader: FileReader,
    FormData: FormData,
    DOMParser: DOMParser,
    XMLSerializer: XMLSerializer,
    
    // DOM events
    Event: Event,
    CustomEvent: CustomEvent,
    MouseEvent: MouseEvent,
    KeyboardEvent: KeyboardEvent,
    
    // Additional globals
    self: null, // Will be set below
    frames: null, // Will be set below
    parent: null, // Will be set below
    top: null, // Will be set below
    window: null, // Will be set below
    globalThis: null, // Will be set below
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
    
    // Eval (not recommended but sometimes needed)
    eval: (code) => {
      try {
        return vm.runInContext(code, ctx, { timeout: 1000 });
      } catch (e) {
        return undefined;
      }
    }
  };
  
  // Set circular references
  sandbox.window = sandbox;
  sandbox.top = sandbox;
  sandbox.parent = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.frames = sandbox;

  // Create the context
  const ctx = vm.createContext(sandbox);
  
  // Extract and execute all scripts
  const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  
  let foundCookie = false;
  
  try {
    // Execute each script sequentially
    for (const s of scripts) {
      if (foundCookie) break;
      
      try {
        // Run the script with a timeout
        vm.runInContext(s, ctx, { timeout: 5000 });
        
        // Check if cookie was set after each script
        if (captured) {
          const m = captured.match(/acw_sc__v2=([^;]+)/);
          if (m) {
            console.log(m[1]);
            foundCookie = true;
            break;
          }
        }
      } catch (e) {
        // Silent fail for individual script errors - continue with next script
        // This is important because WAF challenges often have multiple scripts
        // and some may fail but others will work
      }
    }
    
    // If no cookie found after executing all scripts, try one more check
    if (!foundCookie && captured) {
      const m = captured.match(/acw_sc__v2=([^;]+)/);
      if (m) {
        console.log(m[1]);
        foundCookie = true;
      }
    }
    
    // If still no cookie, try to extract from HTML directly (fallback)
    if (!foundCookie) {
      const dm = html.match(/acw_sc__v2=([^;'"\s&<]+)/);
      if (dm) {
        console.log(dm[1]);
        foundCookie = true;
      }
    }
    
    if (!foundCookie) {
      console.log('NO_COOKIE');
    }
    
  } catch (e) {
    // Only log major errors
    console.error('SOLVE_ERR:', e.message);
    process.exit(2);
  }
});
