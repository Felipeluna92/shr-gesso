import { get, put, list } from '@vercel/blob';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
const local = !process.env.VERCEL && process.env.STORAGE_DRIVER === 'local';
const root = path.resolve('.local-data');
export class Conflict extends Error {}
function localPath(name) { if (!/^[\w./-]+$/.test(name) || name.includes('..')) throw Error('Caminho inválido'); return path.join(root, name); }
function etag(data) { return createHash('sha256').update(data).digest('hex'); }
export async function read(name) {
  if (local) { try { const b = fs.readFileSync(localPath(name)); return { data: b, etag: etag(b) }; } catch(e) { if(e.code==='ENOENT') return null; throw e; } }
  const r = await get(name, { access: 'private', useCache: false });
  if (!r) return null;
  if (r.statusCode !== 200) throw Error('Falha na leitura');
  return { data: Buffer.from(await new Response(r.stream).arrayBuffer()), etag: r.blob.etag };
}
export async function write(name, data, { match, create = false, contentType = 'application/json' } = {}) {
  if (local) { const p = localPath(name); let old; try { old=fs.readFileSync(p); } catch(e) { if(e.code!=='ENOENT') throw e; }
    if((create && old) || (match && (!old || etag(old)!==match))) throw new Conflict('Registro alterado');
    fs.mkdirSync(path.dirname(p),{recursive:true}); fs.writeFileSync(p,data); return etag(data);
  }
  try { const r = await put(name, data, { access: 'private', addRandomSuffix: false, allowOverwrite: !create, ...(match ? { ifMatch: match } : {}), contentType, cacheControlMaxAge: 0 }); return r.etag; }
  catch(e) { if (/Precondition|AlreadyExists/.test(e.constructor.name) || /already exists/i.test(e.message)) throw new Conflict('Registro alterado'); throw e; }
}
export async function names(prefix) {
  if(local) { const walk = d => fs.existsSync(d) ? fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.relative(root,path.join(d,e.name)).replaceAll('\\','/')]) : []; return walk(localPath(prefix)).filter(x=>x.startsWith(prefix)); }
  const all=[]; let cursor; do { const r=await list({prefix,cursor,limit:1000}); all.push(...r.blobs.map(x=>x.pathname)); cursor=r.hasMore?r.cursor:undefined; }while(cursor); return all;
}
export async function json(name) { const r=await read(name); return r ? {value: JSON.parse(r.data.toString()), etag:r.etag} : null; }
