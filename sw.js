// Guarda o app no celular para abrir sem internet.
const CACHE = 'suu-v1';
const FB = 'https://www.gstatic.com/firebasejs/13.4.0/';
const SHELL = [
  './', './index.html', './manifest.json', './icon-192.png', './icon-512.png',
  FB + 'firebase-app.js', FB + 'firebase-auth.js', FB + 'firebase-firestore.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
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

  // Abre na hora com o que está guardado e atualiza por trás (bom pra internet ruim).
  e.respondWith(
    caches.open(CACHE).then(async cache => {
      const guardado = await cache.match(req, { ignoreSearch: doApp });
      const rede = fetch(req).then(res => {
        if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
        return res;
      }).catch(() => null);
      if (guardado) { e.waitUntil(rede); return guardado; }
      const res = await rede;
      if (res) return res;
      if (req.mode === 'navigate') return cache.match('./index.html');
      return new Response('', { status: 504 });
    })
  );
});
