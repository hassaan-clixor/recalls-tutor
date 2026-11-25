import test from 'node:test';
import assert from 'node:assert/strict';
import {pushEndpointAllowed,vapidConfigured} from '../lib/integrations/web-push';

test('push endpoints are limited to the real browser push services over https',()=>{
 assert.equal(pushEndpointAllowed('https://fcm.googleapis.com/fcm/send/abc'),true);
 assert.equal(pushEndpointAllowed('https://updates.push.services.mozilla.com/wpush/v2/abc'),true);
 assert.equal(pushEndpointAllowed('https://web.push.apple.com/abc'),true);
 assert.equal(pushEndpointAllowed('http://fcm.googleapis.com/fcm/send/abc'),false);
 assert.equal(pushEndpointAllowed('https://evil.example.com/fcm.googleapis.com'),false);
 assert.equal(pushEndpointAllowed('https://169.254.169.254/latest/meta-data'),false);
 assert.equal(pushEndpointAllowed('not a url'),false);
});
test('push is off without VAPID keys',()=>{
 const saved={...process.env};delete process.env.VAPID_PUBLIC_KEY;delete process.env.VAPID_PRIVATE_KEY;
 assert.equal(vapidConfigured(),false);Object.assign(process.env,saved);
});
