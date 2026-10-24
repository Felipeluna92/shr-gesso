import {createHmac} from 'node:crypto';
import {json,write,Conflict} from './storage.js';
export async function allowAttempt(req){
 const ip=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();
 const key=createHmac('sha256',process.env.SESSION_SECRET).update(ip).digest('hex');const path='system/limits/'+key+'.json';
 for(let i=0;i<4;i++){const old=await json(path);const now=Date.now();const current=old&&old.value.until>now?old.value:{count:0,until:now+15*60*1000};if(current.count>=10)return false;try{await write(path,JSON.stringify({...current,count:current.count+1}),old?{match:old.etag}:{create:true});return true;}catch(e){if(!(e instanceof Conflict))throw e;}}
 return false;
}
