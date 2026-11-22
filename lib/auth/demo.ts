// Demo switch: AUTH_DEMO_NO_EMAIL=true lets people sign up and sign in with no email step (no verification, no Resend).
// It exists only so a demo can be shown before email delivery is set up. Never use it with live payments: it is refused
// when a live Stripe key is configured.
export function demoNoEmail(): boolean {
 if (process.env.AUTH_DEMO_NO_EMAIL!=='true') return false;
 if ((process.env.STRIPE_SECRET_KEY??'').startsWith('sk_live_')) throw new Error('AUTH_DEMO_NO_EMAIL cannot be used with a live Stripe key.');
 return true;
}
