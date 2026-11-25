// Google sign-in (AUTH-1) is on only when both credentials are configured, so a missing key never shows a broken button.
export function googleCredentials() {
 const clientId=process.env.GOOGLE_CLIENT_ID,clientSecret=process.env.GOOGLE_CLIENT_SECRET;
 return clientId&&clientSecret?{clientId,clientSecret}:null;
}
export const googleEnabled=()=>googleCredentials()!==null;
// Apple sign-in: APPLE_CLIENT_ID is the Services ID; APPLE_CLIENT_SECRET is the signed JWT Apple requires (it expires, so renew it).
export function appleCredentials() {
 const clientId=process.env.APPLE_CLIENT_ID,clientSecret=process.env.APPLE_CLIENT_SECRET;
 return clientId&&clientSecret?{clientId,clientSecret,...(process.env.APPLE_APP_BUNDLE_IDENTIFIER?{appBundleIdentifier:process.env.APPLE_APP_BUNDLE_IDENTIFIER}:{})}:null;
}
export const appleEnabled=()=>appleCredentials()!==null;
