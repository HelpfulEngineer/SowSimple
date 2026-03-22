const SHELL_CACHE = "sow-simple-shell-v3";
const ASSET_CACHE = "sow-simple-assets-v3";
const ACTIVE_CACHES = [SHELL_CACHE, ASSET_CACHE];
const scopePath = new URL(self.registration.scope).pathname.replace(/\/$/, "");

function toAppPath(path) {
  if (path === "/") {
    return `${scopePath}/`;
  }

  return `${scopePath}${path}`;
}

const INDEX_PATH = toAppPath("/index.html");
const ASSET_PREFIX = toAppPath("/assets/");
const SHELL_URLS = [
  "/",
  "/index.html",
  "/favicon-16.png",
  "/favicon-32.png",
  "/apple-touch-icon.png",
  "/icon-192.png",
  "/icon-512.png",
  "/manifest.webmanifest"
].map(toAppPath);

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_URLS))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((key) => !ACTIVE_CACHES.includes(key))
            .map((key) => caches.delete(key))
        )
      ),
      self.clients.claim()
    ])
  );
});

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isStaticAsset(request, url) {
  return (
    isSameOrigin(url) &&
    (request.destination === "script" ||
      request.destination === "style" ||
      request.destination === "image" ||
      request.destination === "font" ||
      request.destination === "manifest" ||
      url.pathname.startsWith(ASSET_PREFIX))
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  if (!isSameOrigin(url)) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(SHELL_CACHE).then((cache) => {
            cache.put(INDEX_PATH, responseClone);
          });
          return response;
        })
        .catch(async () => {
          const cachedResponse =
            (await caches.match(request)) || (await caches.match(INDEX_PATH));
          return cachedResponse || Response.error();
        })
    );
    return;
  }

  if (isStaticAsset(request, url)) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request).then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(ASSET_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }

          return response;
        });
      })
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(ASSET_CACHE).then((cache) => {
            cache.put(request, responseClone);
          });
        }

        return response;
      })
      .catch(async () => (await caches.match(request)) || Response.error())
  );
});
