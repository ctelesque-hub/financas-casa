// Guarda o app no celular para abrir sem internet.
// Com internet, sempre busca a versão nova da página primeiro (assim as atualizações aparecem na hora).
const CACHE = 'suu-v3';
const FB = 'https://www.gstatic.com/firebasejs/13.4.0/';
const SHELL = ['./', './index.html', './manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const doApp = url.origin === self.location.origin;
  const estatico = url.href.startsWith(FB) || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!doApp && !estatico) return; // dados e login vão direto pro Firebase

  if (doApp) {
    // Página e arquivos do app: rede primeiro (sem cache do navegador); sem internet, usa a cópia guardada.
    e.respondWith(
      fetch(req, { cache: 'no-store' }).then(res => {
        if (res && res.ok) { const c = res.clone(); caches.open(CACHE).then(cache => cache.put(req, c)); }
        return res;
      }).catch(async () => {
        const cache = await caches.open(CACHE);
        return (await cache.match(req, { ignoreSearch: true })) || (req.mode === 'navigate' ? cache.match('./index.html') : new Response('', { status: 504 }));
      })
    );
    return;
  }
  // Bibliotecas do Firebase e fontes: não mudam, então usa a cópia guardada.
  e.respondWith(
    caches.open(CACHE).then(async cache => {
      const guardado = await cache.match(req);
      if (guardado) return guardado;
      const res = await fetch(req).catch(() => null);
      if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
      return res || new Response('', { status: 504 });
    })
  );
});
