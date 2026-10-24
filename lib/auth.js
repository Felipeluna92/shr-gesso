import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
export function equal(a,b) { const aa=Buffer.from(String(a)),bb=Buffer.from(String(b)); return aa.length===bb.length && timingSafeEqual(aa,bb); }
export function passwordHash(p,salt=randomBytes(16).toString('hex')) { return salt+':'+scryptSync(p,salt,64).toString('hex'); }
export function checkPassword(p,h) { if(typeof p!=='string' || p.length>200) return false; const [salt]=h.split(':'); return equal(passwordHash(p,salt),h); }
export function token(version) { const p=Buffer.from(JSON.stringify({v:version,exp:Date.now()+1000*60*60*12})).toString('base64url');return p+'.'+sign(p); }
function sign(p) { return createHmac('sha256',process.env.SESSION_SECRET).update(p).digest('base64url'); }
export function session(cookie,version) { try { const t=(cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('shr_session='))?.slice(12); const [p,s]=t.split('.'); if(!equal(s,sign(p))) return false;const v=JSON.parse(Buffer.from(p,'base64url'));return v.v===version && v.exp>Date.now(); }catch{return false;} }
export function cookie(value,maxAge=43200) { return `shr_session=${value}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${maxAge}${process.env.VERCEL?'; Secure':''}`; }
