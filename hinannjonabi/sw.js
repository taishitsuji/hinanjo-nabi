const CACHE_NAME = 'hinan-navi-v2'; // バージョンを2に上げる
const urlsToCache = [
  './index.html',
  './manifest.json',
  './icon.png',
  './shelters.json' // ← これを追加！！
];
// 1. 初回アクセス時にファイルをスマホ内に保存（キャッシュ）する
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(urlsToCache);
    })
  );
});

// 2. オフライン時（または通信時）に保存したファイルを返す
self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request).then(function(response) {
      // キャッシュがあればそれを返し、なければネットに取りに行く
      return response || fetch(event.request);
    })
  );
});