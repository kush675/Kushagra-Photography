import {env} from 'cloudflare:workers';
import {mediaResponse,type PhotoEnv} from '../../../../lib/photo-service';
export const dynamic='force-dynamic';
export async function GET(request:Request){
  const parts=new URL(request.url).pathname.split('/');
  return mediaResponse(request,env as unknown as PhotoEnv,parts[2],parts[3]);
}
