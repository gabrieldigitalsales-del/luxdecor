import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const COOKIE_NAME = 'lux_admin_session';
const SESSION_SECONDS = 60 * 60 * 8;

function env(name, fallback='') { return process.env[name] || fallback; }
function secret(){ return env('ADMIN_SESSION_SECRET', env('ADMIN_PASSWORD')); }
function service(){
  const url = env('SUPABASE_URL', env('VITE_SUPABASE_URL'));
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  if(!url || !key) throw new Error('Configure VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no Vercel.');
  return createClient(url, key, { auth: { persistSession:false, autoRefreshToken:false } });
}
function timingEqual(a,b){
  const aa=Buffer.from(String(a)); const bb=Buffer.from(String(b));
  if(aa.length!==bb.length) return false;
  return crypto.timingSafeEqual(aa,bb);
}
function sign(exp){ return crypto.createHmac('sha256', secret()).update(String(exp)).digest('hex'); }
function makeToken(){ const exp=Math.floor(Date.now()/1000)+SESSION_SECONDS; return `${exp}.${sign(exp)}`; }
function validToken(token){
  if(!token || !secret()) return false;
  const [exp,sig]=String(token).split('.');
  if(!exp || !sig || Number(exp)<Math.floor(Date.now()/1000)) return false;
  return timingEqual(sig,sign(exp));
}
function cookies(req){
  return Object.fromEntries(String(req.headers.cookie||'').split(';').map(x=>x.trim()).filter(Boolean).map(x=>{const i=x.indexOf('=');return [decodeURIComponent(x.slice(0,i)),decodeURIComponent(x.slice(i+1))]}));
}
function authenticated(req){ return validToken(cookies(req)[COOKIE_NAME]); }
function setCookie(res, value, maxAge=SESSION_SECONDS){
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`);
}
function json(res,status,data){ res.status(status).json(data); }
function normalizeProduct(row){
  const ordered=[...(row.product_images||[])].sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));
  const images=ordered.map(x=>x.url).filter(Boolean); const cover=row.cover_url||images[0]||'';
  return {id:row.id,name:row.name,category:row.category?.name||row.category_name||'Outros',categoryId:row.category_id,price:row.price,priceLabel:row.price_label||'Sob consulta',image:cover,images:images.length?images:(cover?[cover]:[]),tag:row.badge||'',desc:row.description||'',features:row.features||[],isActive:row.is_active!==false,sortOrder:row.sort_order||0};
}
function safeExt(name,type){
  const byName=(String(name||'').split('.').pop()||'').toLowerCase();
  const allowed=['jpg','jpeg','png','webp']; if(allowed.includes(byName)) return byName==='jpeg'?'jpg':byName;
  if(type==='image/png')return'png'; if(type==='image/webp')return'webp'; return'jpg';
}

export default async function handler(req,res){
  try{
    const body = typeof req.body === 'string' ? JSON.parse(req.body||'{}') : (req.body||{});
    const action = body.action || req.query?.action || '';
    if(action==='login'){
      const expected=env('ADMIN_PASSWORD');
      if(!expected) return json(res,500,{error:'ADMIN_PASSWORD não configurada no Vercel.'});
      if(!timingEqual(body.password||'',expected)) return json(res,401,{error:'Senha incorreta.'});
      const token=makeToken(); setCookie(res,token); return json(res,200,{ok:true});
    }
    if(action==='logout'){
      setCookie(res,'',0); return json(res,200,{ok:true});
    }
    if(action==='session') return json(res,200,{authenticated:authenticated(req)});
    if(!authenticated(req)) return json(res,401,{error:'Sessão administrativa expirada. Entre novamente.'});

    const sb=service();
    if(action==='products'){
      const {data,error}=await sb.from('luxdecor_products').select('*, category:luxdecor_categories(id,name), product_images:luxdecor_product_images(id,url,storage_path,sort_order,is_cover)').order('sort_order').order('created_at',{ascending:false});
      if(error) throw error; return json(res,200,{products:(data||[]).map(normalizeProduct)});
    }
    if(action==='saveProduct'){
      const p=body.product||{};
      const payload={name:String(p.name||'').trim(),category_id:p.categoryId||null,category_name:p.category||null,price:p.price===''||p.price==null?null:Number(p.price),price_label:p.priceLabel||'Sob consulta',description:p.desc||'',features:Array.isArray(p.features)?p.features:[],badge:p.tag||null,is_active:p.isActive!==false,sort_order:Number(p.sortOrder||0),updated_at:new Date().toISOString()};
      if(!payload.name) return json(res,400,{error:'Informe o nome do produto.'});
      let id=p.id;
      if(id){ const {error}=await sb.from('luxdecor_products').update(payload).eq('id',id); if(error)throw error; }
      else { const {data,error}=await sb.from('luxdecor_products').insert(payload).select('id').single(); if(error)throw error; id=data.id; }
      return json(res,200,{id});
    }
    if(action==='deleteProduct'){
      const id=body.productId; const {data:imgs}=await sb.from('luxdecor_product_images').select('storage_path').eq('product_id',id); const paths=(imgs||[]).map(x=>x.storage_path).filter(Boolean); if(paths.length)await sb.storage.from('luxdecor-products').remove(paths); const {error}=await sb.from('luxdecor_products').delete().eq('id',id); if(error)throw error; return json(res,200,{ok:true});
    }
    if(action==='setCover'){
      const {error}=await sb.from('luxdecor_products').update({cover_url:body.url||null,updated_at:new Date().toISOString()}).eq('id',body.productId); if(error)throw error; return json(res,200,{ok:true});
    }
    if(action==='saveSettings'){
      const s=body.settings||{}; const {error}=await sb.from('luxdecor_site_settings').upsert({id:1,whatsapp:s.whatsapp||'',instagram:s.instagram||'',updated_at:new Date().toISOString()}); if(error)throw error; return json(res,200,{ok:true});
    }
    if(action==='uploadUrl'){
      const bucket=body.bucket==='luxdecor-site-assets'?'luxdecor-site-assets':'luxdecor-products'; const ext=safeExt(body.fileName,body.contentType); const folder=String(body.folder||'catalog').replace(/[^a-zA-Z0-9/_-]/g,'-'); const path=`${folder}/${new Date().toISOString().slice(0,10)}/${crypto.randomUUID()}.${ext}`; const {data,error}=await sb.storage.from(bucket).createSignedUploadUrl(path); if(error)throw error; return json(res,200,{path,token:data.token});
    }
    if(action==='addProductImage'){
      const {error}=await sb.from('luxdecor_product_images').insert({product_id:body.productId,url:body.url,storage_path:body.path,sort_order:Number(body.sortOrder||100),is_cover:Boolean(body.isCover)}); if(error)throw error; return json(res,200,{ok:true});
    }
    if(action==='replaceSiteImage'){
      const {data:old}=await sb.from('luxdecor_site_images').select('storage_path').eq('key',body.key).maybeSingle(); const {error}=await sb.from('luxdecor_site_images').upsert({key:body.key,url:body.url,storage_path:body.path,updated_at:new Date().toISOString()}); if(error)throw error; if(old?.storage_path&&old.storage_path!==body.path)await sb.storage.from('luxdecor-site-assets').remove([old.storage_path]); return json(res,200,{ok:true});
    }
    return json(res,400,{error:'Ação administrativa inválida.'});
  }catch(error){ console.error('Lux Decor admin API:',error); return json(res,500,{error:error?.message||'Erro interno no painel.'}); }
}
