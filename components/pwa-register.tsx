'use client';
import {useEffect} from 'react';
// Registers the service worker once the page has loaded. Browsers without support simply skip it.
export function PwaRegister(){
 useEffect(()=>{
  if(!('serviceWorker' in navigator))return;
  if(window.location.protocol!=='https:'&&window.location.hostname!=='localhost'&&window.location.hostname!=='127.0.0.1')return;
  navigator.serviceWorker.register('/sw.js').catch(()=>{});
 },[]);
 return null;
}
