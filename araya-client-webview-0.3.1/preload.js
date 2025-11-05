
const { contextBridge, ipcRenderer } = require('electron');

const INJECT = (limit) => `
(function() {
  const LIMIT = ${"${limit}"};
  function cut() {
    try {
      const root = document.querySelector('[data-testid="conversation-turns"]') || document.querySelector('main');
      if (!root) return;
      const nodes = Array.from(root.querySelectorAll('[data-testid="conversation-turn"]'));
      if (nodes.length > LIMIT) {
        const extra = nodes.slice(0, nodes.length - LIMIT);
        for (const n of extra) n.style.display = 'none';
      }
      const more = root.querySelectorAll('button');
      for (const b of more) {
        const t = (b.textContent || '').toLowerCase();
        if (t.includes('show more') || t.includes('load more') || t.includes('показать еще')) b.style.display = 'none';
      }
    } catch (e) {}
  }
  cut();
  const mo = new MutationObserver(() => cut());
  mo.observe(document.documentElement, { childList: true, subtree: true });
  if (!document.getElementById('araya-badge')) {
    const badge = document.createElement('div');
    badge.id = 'araya-badge';
    badge.style.cssText = 'position:fixed;top:8px;right:12px;z-index:999999;padding:4px 8px;background:#111;color:#fff;border-radius:8px;font:12px/16px system-ui,Segoe UI,Arial;opacity:.8;';
    badge.textContent = 'Araya limit: ' + LIMIT;
    document.body.appendChild(badge);
  }
})();
`;

function exec(script) {
  try {
    const s = document.createElement('script');
    s.textContent = script;
    (document.head || document.documentElement).appendChild(s);
    s.remove();
  } catch (e) {}
}

let currentLimit = 50;

contextBridge.exposeInMainWorld('araya', {
  setLimit: (n) => { currentLimit = n; exec(INJECT(String(n))); },
  googleSignIn: () => ipcRenderer.invoke('oauth:google')
});

ipcRenderer.on('araya:setLimit', (_e, n) => { currentLimit = n; exec(INJECT(String(n))); });
ipcRenderer.on('araya:oauthResult', (_e, payload) => {
  window.dispatchEvent(new CustomEvent('araya:oauthResult', { detail: payload }));
});

window.addEventListener('DOMContentLoaded', () => { exec(INJECT(String(currentLimit))); });
