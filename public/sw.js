// Thermogestion — service worker minimal : app installable + tolérance réseau.
// Lot C, C4 : précache réel de la coquille à l'installation (dont /scan et /pointage), pour
// qu'un opérateur qui ouvre l'app hors ligne pour la première fois du jour tombe sur l'écran
// plutôt que sur une erreur de navigation. Bump de version = purge de l'ancien cache.
// Vague 4 — /aide-publique (nouvelle page publique) ajoutée au précache : bump de version pour
// purger l'ancien cache (voir le commentaire d'en-tête, « bump de version = purge »).
const CACHE = "tg-v3";
const SHELL = ["/dashboard", "/projets", "/devis", "/clients", "/stock", "/scan", "/pointage", "/aide-publique"];

self.addEventListener("install", (e) => {
  // `{ cache: "reload" }` : on va chercher une réponse fraîche pour le précache lui-même, sinon on
  // risquerait de figer dans le cache une réponse déjà périmée servie par le cache HTTP du navigateur.
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => Promise.all(SHELL.map((p) => fetch(p, { cache: "reload" }).then((r) => c.put(p, r)).catch(() => {}))))
      .then(() => self.skipWaiting()),
  );
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
// network-first pour les pages, cache en secours (dernier état vu, ou précache initial)
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname.startsWith("/_next/static/") || url.pathname.match(/\.(png|svg|ico|woff2?)$/)) {
    e.respondWith(caches.open(CACHE).then(async (c) => (await c.match(e.request)) ?? fetch(e.request).then((r) => { c.put(e.request, r.clone()); return r; })));
    return;
  }
  // /scan/<qr> est une route dynamique : on ne peut pas précacher chaque QR à l'avance, mais on
  // sert la même coquille /scan en secours hors ligne — l'app affiche alors son propre état
  // "QR inconnu / hors ligne" côté client plutôt qu'un échec de navigation complet du navigateur.
  const clePrecache = SHELL.find((p) => url.pathname === p || url.pathname.startsWith(`${p}/`));
  if (clePrecache) {
    e.respondWith(
      fetch(e.request)
        .then((r) => { caches.open(CACHE).then((c) => c.put(e.request, r.clone())); return r; })
        .catch(() => caches.match(e.request).then((r) => r ?? caches.match(clePrecache))),
    );
  }
});
