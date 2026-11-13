const CACHE_NAME = 'hinanjo-navi-core-v3';
const DATA_CACHE_NAME = 'hinanjo-navi-data-v3';
const TILE_CACHE_NAME = 'hinanjo-navi-tiles-v3';

// アプリ起動に絶対必要なコアファイル
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.png',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

// 1. インストール時にコアファイルを1つずつ確実に保存する
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const url of CORE_ASSETS) {
        try {
          await cache.add(url);
        } catch (err) {
          console.warn('キャッシュスキップ:', url, err);
        }
      }
    })
  );
});

// 2. 古いバージョンのキャッシュを自動削除
self.addEventListener('activate', (event) => {
  const validCaches = [CACHE_NAME, DATA_CACHE_NAME, TILE_CACHE_NAME];
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (!validCaches.includes(key)) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. 通信時の制御（オンライン時は最新を取得して保存、オフライン時は保存データを返す）
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // A. ルート検索API（OSRM）はオフライン時は即エラーを返して直線レーダーへ切り替えさせる
  if (url.hostname.includes('project-osrm.org')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // B. 避難所データ（shelters.json）の処理
  if (url.pathname.endsWith('shelters.json')) {
    event.respondWith(
      caches.open(DATA_CACHE_NAME).then(async (cache) => {
        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse.ok) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        } catch (err) {
          const cachedResponse = await cache.match(event.request);
          if (cachedResponse) return cachedResponse;
          throw err;
        }
      })
    );
    return;
  }

  // C. 地図画像（OpenStreetMapタイル）の処理：一度見た場所の地図を自動保存
  if (url.hostname.includes('tile.openstreetmap.org')) {
    event.respondWith(
      caches.open(TILE_CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }
        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse.ok) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        } catch (err) {
          return new Response('', { status: 404 });
        }
      })
    );
    return;
  }

  // D. アプリ画面本体（HTML / JS / CSSなど）の処理
  event.respondWith(
    caches.match(event.request).then(async (cachedResponse) => {
      // 画面遷移（アプリ起動時）はオフラインなら確実に index.html を返す
      if (event.request.mode === 'navigate') {
        try {
          const networkResponse = await fetch(event.request);
          const cache = await caches.open(CACHE_NAME);
          cache.put('./index.html', networkResponse.clone());
          return networkResponse;
        } catch (err) {
          const fallback = await caches.match('./index.html') || await caches.match('./');
          if (fallback) return fallback;
        }
      }

      if (cachedResponse) {
        return cachedResponse;
      }

      try {
        const networkResponse = await fetch(event.request);
        if (networkResponse.ok && event.request.method === 'GET') {
          const cache = await caches.open(CACHE_NAME);
          cache.put(event.request, networkResponse.clone());
        }
        return networkResponse;
      } catch (err) {
        return caches.match('./index.html');
      }
    })
  );
});
