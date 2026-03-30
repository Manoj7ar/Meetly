const CACHE = "meetly-v3";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(["/", "/index.html", "/manifest.webmanifest", "/favicon.svg"]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.pathname.startsWith("/call") || url.pathname.startsWith("/api/")) return;

  // Network-first for bundled app: avoids stale JS after deploy and prevents
  // ever serving index.html as a script (which breaks the module and all clicks).
  if (url.pathname === "/app.js") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            caches.open(CACHE).then((c) => c.put(req, res.clone()));
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).catch(() => {
        if (req.mode === "navigate") {
          return caches.match("/index.html");
        }
        return new Response("", { status: 503 });
      });
    })
  );
});
