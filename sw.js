// Service worker : appli disponible hors connexion et mises à jour contrôlées.
importScripts('version.js');
const CACHE = 'cave-' + self.APP_VERSION;
const FILES = ['./', 'index.html', 'styles.css', 'version.js', 'app.js', 'util.js', 'logic.js', 'store.js', 'ai.js', 'importer.js', 'files.js', 'quotes.js', 'stats.js', 'notes.js', 'chiffres.js', 'taxonomie.js', 'bible/bible.json', 'xlsx.min.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable.png'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // cache: 'reload' contourne le cache HTTP de l'hébergeur : on stocke bien la nouvelle version
    await Promise.all(FILES.map(async f => {
      const res = await fetch(new Request(f, { cache: 'reload' }));
      if (!res.ok) throw new Error('Fichier manquant : ' + f + ' (' + res.status + ')');
      await cache.put(f, res);
    }));
  })());
  // pas de skipWaiting automatique : l'utilisateur choisit « Mettre à jour »
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('cave-') && k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // appels aux IA : jamais mis en cache
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try { return await fetch(req); }
    catch (e) {
      if (req.mode === 'navigate') { const idx = await cache.match('index.html'); if (idx) return idx; }
      return Response.error();
    }
  })());
});
