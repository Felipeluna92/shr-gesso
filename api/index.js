import {allowAttempt} from '../lib/rate-limit.js';
import {randomUUID} from 'node:crypto';
import {read,write,json,names,Conflict} from '../lib/storage.js';
import {validate,Validation,uuidPattern} from '../lib/model.js';
import {equal,passwordHash,checkPassword,token,session,cookie} from '../lib/auth.js';
export const config={api:{bodyParser:false}};
async function body(req,limit=65536) {
 if(req.body!==undefined) { if(Buffer.isBuffer(req.body)){if(req.body.length>limit)throw new Validation('Arquivo muito grande.');return req.body;}const b=Buffer.from(typeof req.body==='string'?req.body:JSON.stringify(req.body));if(b.length>limit)throw new Validation('Conteúdo muito grande.');return b; }
 const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>limit)throw new Validation('Arquivo muito grande.');chunks.push(chunk);}return Buffer.concat(chunks);
}
async function data(req){try{return JSON.parse((await body(req)).toString());}catch(e){if(e instanceof Validation)throw e;throw new Validation('Dados inválidos.');}}
export default async function handler(req,res) {
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Vary','Cookie');
 const send=(status,v)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(v));};
 try {
  if(!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length<32 || !process.env.ADMIN_SETUP_KEY || process.env.ADMIN_SETUP_KEY.length<16 || (process.env.VERCEL && !process.env.BLOB_READ_WRITE_TOKEN && !process.env.BLOB_STORE_ID)) return send(503,{error:'Configuração pendente na Vercel. Configure o armazenamento privado e as chaves de acesso.'});
  const url=new URL(req.url,'http://localhost');const action=url.searchParams.get('action')||'session';
  if(!['GET','POST'].includes(req.method))return send(405,{error:'Método não permitido.'});
  if(req.method==='POST' && req.headers.origin) { const host=req.headers['x-forwarded-host']||req.headers.host;if(new URL(req.headers.origin).host!==host)return send(403,{error:'Origem inválida.'}); }
  const account=await json('system/admin.json');
  const signed=account && session(req.headers.cookie,account.value.version);
  if(action==='session' && req.method==='GET')return send(200,{setup:!account,authenticated:!!signed,name:signed?account.value.name:undefined});
  if(['setup','login','password'].includes(action) && req.method==='POST' && !(await allowAttempt(req))){res.setHeader('Retry-After','900');return send(429,{error:'Muitas tentativas. Aguarde 15 minutos e tente novamente.'});}
  if(action==='setup' && req.method==='POST'){
   if(account)return send(409,{error:'O administrador já foi configurado.'});const d=await data(req);
   if(!equal(d.key,process.env.ADMIN_SETUP_KEY))return send(401,{error:'Código de ativação inválido.'});
   if(typeof d.password!=='string'||d.password.length<12||d.password.length>200||typeof d.name!=='string'||!d.name.trim()||d.name.length>80)throw new Validation('Informe seu nome e uma senha de pelo menos 12 caracteres.');
   const a={name:d.name.trim(),hash:passwordHash(d.password),version:randomUUID()};await write('system/admin.json',JSON.stringify(a),{create:true});res.setHeader('Set-Cookie',cookie(token(a.version)));return send(200,{ok:true,name:a.name});
  }
  if(action==='login' && req.method==='POST') { const d=await data(req);if(!account || !checkPassword(d.password,account.value.hash))return send(401,{error:'Senha incorreta.'});res.setHeader('Set-Cookie',cookie(token(account.value.version)));return send(200,{ok:true,name:account.value.name}); }
  if(!signed)return send(401,{error:'Entre com sua senha para continuar.'});
  if(action==='logout' && req.method==='POST'){res.setHeader('Set-Cookie',cookie('',0));return send(200,{ok:true});}
  if(action==='password' && req.method==='POST'){const d=await data(req);if(!checkPassword(d.current,account.value.hash))return send(401,{error:'Senha atual incorreta.'});if(typeof d.password!=='string'||d.password.length<12||d.password.length>200)throw new Validation('Use uma senha de 12 a 200 caracteres.');const a={...account.value,hash:passwordHash(d.password),version:randomUUID()};await write('system/admin.json',JSON.stringify(a),{match:account.etag});res.setHeader('Set-Cookie',cookie(token(a.version)));return send(200,{ok:true});}
  if(action==='records' && req.method==='GET'){const paths=await names('records/');const items=[];for(let i=0;i<paths.length;i+=20){const batch=await Promise.all(paths.slice(i,i+20).map(p=>json(p)));items.push(...batch.filter(x=>x&&!x.value.deleted).map(x=>({...x.value,etag:x.etag})));}return send(200,{records:items.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))});}
  if(action==='save' && req.method==='POST'){const d=await data(req);const r=validate(d);const old=await json('records/'+r.id+'.json');if(old && (!d.etag || old.etag!==d.etag))throw new Conflict();if(!old && d.etag)throw new Conflict();
   const saved={...r,createdAt:old?.value.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};const etag=await write('records/'+r.id+'.json',JSON.stringify(saved),old?{match:d.etag}:{create:true});return send(200,{record:{...saved,etag}});}
  if(action==='delete' && req.method==='POST'){const d=await data(req);if(!uuidPattern.test(d.id))throw new Validation('Identificador inválido.');const old=await json('records/'+d.id+'.json');if(!old || !d.etag || old.etag!==d.etag)throw new Conflict();await write('records/'+d.id+'.json',JSON.stringify({...old.value,deleted:true,updatedAt:new Date().toISOString()}),{match:d.etag});return send(200,{ok:true});}
  if(action==='photo' && req.method==='POST'){const id=url.searchParams.get('id');if(!uuidPattern.test(id))throw new Validation('Identificador inválido.');const b=await body(req,3*1024*1024);let ext;if(b.length>12&&b[0]===255&&b[1]===216&&b[2]===255)ext='jpg';else if(b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))ext='png';else if(b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP')ext='webp';else throw new Validation('Use uma imagem JPG, PNG ou WebP válida.');const p='photos/'+id+'/'+randomUUID()+'.'+ext;await write(p,b,{create:true,contentType:ext==='jpg'?'image/jpeg':'image/'+ext});return send(200,{path:p});}
  if(action==='photo' && req.method==='GET'){const p=url.searchParams.get('path')||'';if(!/^photos\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(p))return send(404,{error:'Foto não encontrada.'});const r=await read(p);if(!r)return send(404,{error:'Foto não encontrada.'});res.setHeader('Content-Type',p.endsWith('.jpg')?'image/jpeg':p.endsWith('.png')?'image/png':'image/webp');res.end(r.data);return;}
  return send(404,{error:'Ação não encontrada.'});
 }catch(e){if(e instanceof Conflict)return send(409,{error:'Este registro foi alterado em outro aparelho. Atualize a lista antes de tentar novamente.'});if(e instanceof Validation)return send(400,{error:e.message});console.error('SHR API:',e.constructor.name);return send(500,{error:'Não foi possível concluir. Tente novamente. Se persistir, confira a configuração do armazenamento.'});}
}
