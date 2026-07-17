const CACHE_NAME = 'naija-fit-v2'
const ASSETS_TO_CACHE = [
  '/',
  '/manifest.json',
  '/icon.svg',
]

// Install Service Worker and cache the core app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Service Worker: Caching App Shell')
      return cache.addAll(ASSETS_TO_CACHE)
    })
  )
  self.skipWaiting()
})

// Activate Service Worker and clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Service Worker: Clearing Old Cache', cache)
            return caches.delete(cache)
          }
        })
      )
    })
  )
  self.clients.claim()
})

// Fetch assets
self.addEventListener('fetch', (event) => {
  // Only handle GET requests and local navigation/assets
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
    return
  }

  const url = new URL(event.request.url)

  // 1. API routes: Always Network-Only (do not cache)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request))
    return
  }

  // 2. Page Navigations (HTML files): Network-First
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // If the network response is valid, return it (do not cache dynamic pages to avoid auth redirects getting stuck)
          return response
        })
        .catch(() => {
          // If offline, serve the cached app shell / root
          return caches.match('/')
        })
    )
    return
  }

  // 3. Static Assets (CSS, JS, Images, Fonts, manifest): Cache-First
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse
      }

      return fetch(event.request).then((response) => {
        // Cache successful local GET requests for static assets on-demand
        if (response && response.status === 200 && response.type === 'basic') {
          // Only cache static assets (Next.js bundles, images, icons, manifest)
          const isStaticAsset = 
            url.pathname.startsWith('/_next/static/') || 
            url.pathname.match(/\.(png|jpg|jpeg|gif|webp|svg|css|js|json|woff2?)$/)
          
          if (isStaticAsset) {
            const responseToCache = response.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache)
            })
          }
        }
        return response
      }).catch(() => {
        // Fallback for missing/offline static resources
        return new Response('Offline resource not available', { status: 503, statusText: 'Offline' })
      })
    })
  )
})
