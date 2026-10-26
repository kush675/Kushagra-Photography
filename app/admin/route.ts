import { env } from 'cloudflare:workers';
import studio from '../../content/admin.html?raw';
import { authorizeOwner, type PhotoEnv } from '../../lib/photo-service';
import { chatGPTSignInPath } from '../chatgpt-auth';
export const dynamic = 'force-dynamic';
const headers = {'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','X-Robots-Tag':'noindex, nofollow'};
export async function GET(request: Request) {
  if (!request.headers.get('oai-authenticated-user-id')) return new Response(null,{status:303,headers:{Location:new URL(chatGPTSignInPath('/admin'),request.url).href,'Cache-Control':'private, no-store'}});
  try {
    if (await authorizeOwner(request, env as unknown as PhotoEnv)) return new Response(studio,{headers});
  } catch {
    return new Response('<!doctype html><html><meta name="viewport" content="width=device-width"><title>Studio unavailable</title><body style="font:16px -apple-system,sans-serif;background:#080808;color:#f5f5f7;padding:8vw"><h1>Please try again shortly.</h1><p>Your studio could not be opened.</p><a href="/" style="color:inherit">Return to portfolio</a></body></html>',{status:503,headers});
  }
  return new Response('<!doctype html><html><meta name="viewport" content="width=device-width"><title>Owner access only</title><body style="font:16px -apple-system,sans-serif;background:#080808;color:#f5f5f7;padding:8vw"><h1>This studio is private.</h1><p>Sign in with the portfolio owner’s account to upload photographs.</p><a href="/" style="color:inherit">Return to portfolio</a></body></html>',{status:403,headers});
}
