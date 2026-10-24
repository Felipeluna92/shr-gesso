export const statuses=['pending','approved','scheduled','progress','done','rejected','cancelled'];
export const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export class Validation extends Error {}
export function validate(input) {
 const o={};
 for(const [k,max] of Object.entries({client:120,phone:25,email:160,address:400,title:160,type:100,notes:5000,measurements:300,start:16,end:16})) {
  if(typeof input[k]!=='string') throw new Validation('Campo inválido: '+k);
  o[k]=input[k].trim(); if(o[k].length>max) throw new Validation('Campo muito longo: '+k);
 }
 if(!o.client || !o.title || o.phone.replace(/\D/g,'').length<10 || o.phone.replace(/\D/g,'').length>13) throw new Validation('Preencha o cliente, o serviço e um telefone válido.');
 if(o.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(o.email)) throw new Validation('E-mail inválido.');
 if(!statuses.includes(input.status)) throw new Validation('Situação inválida.'); o.status=input.status;
 for(const k of ['price','paid']) { if(!Number.isSafeInteger(input[k]) || input[k]<0 || input[k]>10000000000) throw new Validation('Valor inválido.'); o[k]=input[k]; }
 if(o.paid>o.price) throw new Validation('O valor recebido não pode superar o combinado.');
 for(const k of ['start','end']) if(o[k]) { const m=o[k].match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/); if(!m || +m[2]>23 || +m[3]>59 || Number.isNaN(Date.parse(o[k])) || new Date(o[k].slice(0,10)+'T12:00:00Z').toISOString().slice(0,10)!==o[k].slice(0,10)) throw new Validation('Data ou horário inválido.'); }
 if(o.end && (!o.start || o.end<=o.start)) throw new Validation('O término deve ser após o início.');
 if(['scheduled','progress','done'].includes(o.status) && (!o.start || !o.end || !o.address)) throw new Validation('Informe início, término e endereço para agendar o serviço.');
 if(!uuidPattern.test(input.id)) throw new Validation('Identificador inválido.'); o.id=input.id;
 if(!Array.isArray(input.photos) || input.photos.length>8 || !input.photos.every(x=>typeof x==='string' && new RegExp('^photos/'+o.id+'/[0-9a-f-]+\\.(jpg|png|webp)$').test(x))) throw new Validation('Fotos inválidas.');
 o.photos=[...new Set(input.photos)];return o;
}
