// Next.js calls onRequestError for every unhandled server error (pages, route handlers, server actions).
export async function onRequestError(error:unknown,request:{path:string;method:string},context:{routePath?:string}) {
 const {reportError}=await import('./lib/integrations/sentry');
 await reportError(error,{path:request.path,method:request.method,route:context.routePath});
}
