import { env } from 'cloudflare:workers';
import { sessionResponse, listPhotos, uploadPhoto, uploadPreview, type PhotoEnv } from '../../../lib/photo-service';
export const dynamic = 'force-dynamic';
const bindings=()=>env as unknown as PhotoEnv;
function missing(){return Response.json({error:'Not found.'},{status:404,headers:{'Cache-Control':'no-store'}})}
export async function GET(request:Request){
  const path=new URL(request.url).pathname.replace(/\/$/,'');
  if(path==='/api/session')return sessionResponse(request,bindings());
  if(path==='/api/photos')return listPhotos(request,bindings());
  return missing();
}
export async function POST(request:Request){
  const path=new URL(request.url).pathname.replace(/\/$/,'');
  if(path==='/api/admin/photos')return uploadPhoto(request,bindings());
  const match=path.match(/^\/api\/admin\/photos\/([^/]+)\/preview$/);
  if(match)return uploadPreview(request,bindings(),match[1]);
  return missing();
}
