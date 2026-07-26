const CACHE_VERSION='zonemind-0.9.6';
const APP_SHELL=['/','/index.html','/manifest.webmanifest','/assets/css/mapper.css','/assets/js/mapper.js','/assets/icons/icon-192.png','/assets/icons/icon-512.png'];
const SCANNER_CDN='https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE_VERSION).then(cache=>cache.addAll(APP_SHELL))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting()});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET')return;
 if(url.href===SCANNER_CDN){event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{const copy=response.clone();caches.open(CACHE_VERSION).then(cache=>cache.put(request,copy));return response})));return}
 if(url.origin!==self.location.origin)return;
 if(url.pathname.startsWith('/api/')){event.respondWith(fetch(request));return}
 if(request.mode==='navigate'){event.respondWith(fetch(request).catch(()=>caches.match('/index.html')));return}
 event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE_VERSION).then(cache=>cache.put(request,copy))}return response})));
});
