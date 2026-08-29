const fs = require('fs');
const vm = require('vm');

let html = '';
process.stdin.resume();
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => { html += d; });
process.stdin.on('end', () => {
  const textareaInner = (html.match(/<textarea id="renderData"[^>]*>([\s\S]*?)<\/textarea>/) || [])[1] || '';

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
  const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
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