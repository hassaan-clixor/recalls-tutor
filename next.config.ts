import type {NextConfig} from 'next';
const config:NextConfig={
 // Local QA only: lets an isolated preview build into ignored .local/ beside a running dev server.
 ...(process.env.NEXT_DIST_DIR?.startsWith('.local/')?{distDir:process.env.NEXT_DIST_DIR}:{}),
 // Recall uploads are capped at 4 MB in total in the action; this leaves room for multipart overhead.
 experimental:{serverActions:{bodySizeLimit:'5mb'}},
 serverExternalPackages:['@electric-sql/pglite','postgres','tesseract.js','@tesseract.js-data/eng','@napi-rs/canvas','heic-decode'],
 outputFileTracingIncludes:{'/studio':['./node_modules/@tesseract.js-data/eng/4.0.0_best_int/*.gz','./node_modules/.pnpm/tesseract.js-core@*/node_modules/tesseract.js-core/**/*','./node_modules/tesseract.js/src/worker-script/**/*','./node_modules/@napi-rs/canvas*/**/*','./node_modules/.pnpm/libheif-js@*/node_modules/libheif-js/**/*']},
 async headers(){return [{source:'/(.*)',headers:[
  {key:'X-Content-Type-Options',value:'nosniff'},
  {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
  {key:'X-Frame-Options',value:'DENY'},
  // HTTPS everywhere (PRD 10.2): browsers remember to use https for two years. Ignored on plain http.
  {key:'Strict-Transport-Security',value:'max-age=63072000; includeSubDomains'},
  {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=(), payment=(), usb=()'},
 ]}];},
};
export default config;
