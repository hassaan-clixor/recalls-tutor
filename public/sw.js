// Recalls Tutor service worker: an offline fallback for page loads, and web push notifications.
const CACHE='rt-shell-v1';
const OFFLINE='/offline';
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.add(OFFLINE)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
// Only page navigations fall back to the offline screen. API calls, questions and answers always go to the network.
self.addEventListener('fetch',e=>{
 if(e.request.mode!=='navigate')return;
 e.respondWith(fetch(e.request).catch(()=>caches.match(OFFLINE)));
});
// Pushes carry no payload, so the message is fixed and no student data passes through the push service.
self.addEventListener('push',e=>{e.waitUntil(self.registration.showNotification('Recalls Tutor',{body:'You have questions due for review. A few minutes keeps your streak alive.',icon:'/icons/192',badge:'/icons/192',tag:'reviews-due',data:{url:'/practice'}}));});
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(self.clients.matchAll({type:'window'}).then(list=>{for(const c of list){if('focus' in c)return c.focus();}return self.clients.openWindow('/practice');}));});
