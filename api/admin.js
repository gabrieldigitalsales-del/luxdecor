import {readErpProducts,erpLabel} from './_erp.js';
import {sameErpModel} from '../src/utils/erpModel.js';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const COOKIE_NAME = 'lux_admin_session';
const SESSION_SECONDS = 60 * 60 * 8;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 5;
const loginAttempts = new Map();

function env(name, fallback='') { return process.env[name] || fallback; }
function secret(){ return env('ADMIN_SESSION_SECRET'); }
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
function clientKey(req){
  const raw=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown');
  return raw.split(',')[0].trim()||'unknown';
}
function canAttemptLogin(req){
  const key=clientKey(req), now=Date.now();
  const state=loginAttempts.get(key);
  if(!state || now-state.start>LOGIN_WINDOW_MS){loginAttempts.set(key,{start:now,count:0});return true}
  return state.count<LOGIN_MAX_ATTEMPTS;
}
function recordFailedLogin(req){
  const key=clientKey(req), now=Date.now();
  const state=loginAttempts.get(key);
  if(!state || now-state.start>LOGIN_WINDOW_MS) loginAttempts.set(key,{start:now,count:1});
  else loginAttempts.set(key,{...state,count:state.count+1});
}
function clearLoginAttempts(req){loginAttempts.delete(clientKey(req));}
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
      if(!expected || !secret()) return json(res,500,{error:'Configure ADMIN_PASSWORD e ADMIN_SESSION_SECRET no Vercel.'});
      if(!canAttemptLogin(req)) return json(res,429,{error:'Muitas tentativas de acesso. Tente novamente mais tarde.'});
      if(!timingEqual(body.password||'',expected)){recordFailedLogin(req);return json(res,401,{error:'Senha incorreta.'});}
      clearLoginAttempts(req);
      const token=makeToken(); setCookie(res,token); return json(res,200,{ok:true});
    }
    if(action==='logout'){
      setCookie(res,'',0); return json(res,200,{ok:true});
    }
    if(action==='session') return json(res,200,{authenticated:authenticated(req)});
    if(!authenticated(req)) return json(res,401,{error:'Sessão administrativa expirada. Entre novamente.'});

    const sb=service();
    if(action==='erpIntegrationInfo'){
      const [erp,links]=await Promise.all([readErpProducts(sb),sb.from('luxdecor_erp_product_links').select('site_product_id,erp_product_id')]);
      if(links.error)throw links.error;
      return json(res,200,{erp:erp.items.map(p=>({id:String(p.id),name:erpLabel(p),modelName:String(p.nome_produto||p.name||''),stock:Number(p.stock)||0,unknown:/quantidade n[aã]o informada/i.test(String(p.observacoes||'')),publishOnSite:p.publishOnSite===true,price:Number(p.preco_final??p.price)||0})),links:links.data||[],revision:erp.revision});
    }
    if(action==='erpLink'){
      const siteId=String(body.siteProductId||''),erpId=String(body.erpProductId||'');
      if(!/^[0-9a-f-]{36}$/i.test(siteId)||!erpId||erpId.length>128)return json(res,400,{error:'Produto inválido.'});
      const erp=await readErpProducts(sb);
      const erpItem=erp.items.find(p=>String(p.id)===erpId);
      if(!erpItem)return json(res,404,{error:'Item não encontrado no ERP.'});
      if(erpItem.active===false||erpItem.archivedAt||erpItem.publishOnSite!==true)return json(res,400,{error:'Esta variação precisa estar ativa e liberada no ERP.'});
      const {data:site,error:siteError}=await sb.from('luxdecor_products').select('id,name').eq('id',siteId).maybeSingle();
      if(siteError)throw siteError;
      if(!site)return json(res,404,{error:'Produto não encontrado no site.'});
      if(!sameErpModel(site.name,erpItem.nome_produto||erpItem.name))return json(res,400,{error:'Esta variação pertence a outro modelo. Escolha uma variação do mesmo produto.'});
      const {data:elsewhere,error:lookupError}=await sb.from('luxdecor_erp_product_links').select('site_product_id').eq('erp_product_id',erpId);
      if(lookupError)throw lookupError;
      if((elsewhere||[]).some(link=>String(link.site_product_id)!==siteId))return json(res,409,{error:'Esta variação já está associada a outro produto.'});
      const {error}=await sb.from('luxdecor_erp_product_links').upsert({site_product_id:siteId,erp_product_id:erpId},{onConflict:'site_product_id,erp_product_id'});if(error)throw error;
      return json(res,200,{ok:true});
    }
    if(action==='erpCreateDraft'){
      const erpId=String(body.erpProductId||'');
      if(!erpId||erpId.length>128)return json(res,400,{error:'Variação ERP inválida.'});
      const erp=await readErpProducts(sb);
      const item=erp.items.find(p=>String(p.id)===erpId);
      if(!item||item.active===false||item.archivedAt||item.publishOnSite!==true)return json(res,400,{error:'Somente produtos ativos e liberados no ERP podem entrar na fila.'});
      const {data:existing,error:existingError}=await sb.from('luxdecor_erp_product_links').select('site_product_id').eq('erp_product_id',erpId).limit(1);
      if(existingError)throw existingError;
      if(existing?.length)return json(res,409,{error:'Esta variação já está associada a um produto do site. Atualize a lista.'});
      const name=String(body.name||item.nome_produto||item.name||'').trim().slice(0,160);
      const category=String(body.category||'Outros').trim().slice(0,80)||'Outros';
      const description=String(body.description||'').trim().slice(0,3000);
      if(name.length<2)return json(res,400,{error:'Informe um nome válido para o produto.'});
      const rawPrice=item.preco_final??item.price;
      const amount=rawPrice==null||rawPrice===''?NaN:Number(rawPrice);
      const price=Number.isFinite(amount)&&amount>0?Number(amount.toFixed(2)):null;
      const {data:created,error:createError}=await sb.from('luxdecor_products').insert({
        name,category_name:category,description,features:[],price,
        price_label:price?price.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'Sob consulta',
        badge:'Novo',is_active:false,sort_order:0,updated_at:new Date().toISOString()
      }).select('id').single();
      if(createError)throw createError;
      const {error:linkError}=await sb.from('luxdecor_erp_product_links').insert({site_product_id:created.id,erp_product_id:erpId});
      if(linkError){
        await sb.from('luxdecor_products').delete().eq('id',created.id);
        if(linkError.code==='23505')return json(res,409,{error:'Esta variação já está vinculada. Atualize a lista.'});
        throw linkError;
      }
      return json(res,200,{ok:true,id:created.id,draft:true});
    }
    if(action==='erpUnlink'){
      const {error}=await sb.from('luxdecor_erp_product_links').delete().eq('site_product_id',String(body.siteProductId||'')).eq('erp_product_id',String(body.erpProductId||''));
      if(error)throw error;return json(res,200,{ok:true});
    }
    if(action==='products'){
      const {data,error}=await sb.from('luxdecor_products').select('*, category:luxdecor_categories(id,name), product_images:luxdecor_product_images(id,url,storage_path,sort_order,is_cover)').order('sort_order').order('created_at',{ascending:false});
      if(error) throw error; return json(res,200,{products:(data||[]).map(normalizeProduct)});
    }
    if(action==='saveProduct'){
      const p=body.product||{};
      const payload={name:String(p.name||'').trim(),category_id:p.categoryId||null,category_name:p.category||null,price:p.price===''||p.price==null?null:Number(p.price),price_label:p.priceLabel||'Sob consulta',description:p.desc||'',features:Array.isArray(p.features)?p.features:[],badge:p.tag||null,is_active:p.isActive!==false,sort_order:Number(p.sortOrder||0),updated_at:new Date().toISOString()};
      if(!payload.name) return json(res,400,{error:'Informe o nome do produto.'});
      let id=p.id;
      if(id&&payload.is_active){
        const {data:current,error:currentError}=await sb.from('luxdecor_products').select('id,is_active,cover_url,description').eq('id',id).maybeSingle();
        if(currentError)throw currentError;
        if(!current)return json(res,404,{error:'Produto não encontrado.'});
        if(current.is_active===false){
          const {data:linked,error:linkError}=await sb.from('luxdecor_erp_product_links').select('erp_product_id').eq('site_product_id',id).limit(1);
          if(linkError)throw linkError;
          if(linked?.length){
            const {data:images,error:imageError}=await sb.from('luxdecor_product_images').select('id').eq('product_id',id).limit(1);
            if(imageError)throw imageError;
            if(!(current.cover_url||images?.length))return json(res,400,{error:'Adicione uma foto ao produto antes de publicá-lo no catálogo.'});
            if(!payload.description.trim())return json(res,400,{error:'Informe a descrição do produto antes de publicá-lo.'});
          }
        }
      }
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
    if(action==='removeProductImage'){
      const {data:img,error:findError}=await sb.from('luxdecor_product_images').select('id,storage_path').eq('product_id',body.productId).eq('url',body.url).maybeSingle();
      if(findError)throw findError;
      if(img?.storage_path)await sb.storage.from('luxdecor-products').remove([img.storage_path]);
      if(img?.id){const {error}=await sb.from('luxdecor_product_images').delete().eq('id',img.id);if(error)throw error;}
      const {data:prod}=await sb.from('luxdecor_products').select('cover_url').eq('id',body.productId).maybeSingle();
      if(prod?.cover_url===body.url)await sb.from('luxdecor_products').update({cover_url:null,updated_at:new Date().toISOString()}).eq('id',body.productId);
      return json(res,200,{ok:true});
    }
    if(action==='classifyImage') return json(res,410,{error:'A análise de imagens agora usa o Ollama local diretamente no navegador.'});
    if(action==='replaceSiteImage'){
      const {data:old}=await sb.from('luxdecor_site_images').select('storage_path').eq('key',body.key).maybeSingle(); const {error}=await sb.from('luxdecor_site_images').upsert({key:body.key,url:body.url,storage_path:body.path,updated_at:new Date().toISOString()}); if(error)throw error; if(old?.storage_path&&old.storage_path!==body.path)await sb.storage.from('luxdecor-site-assets').remove([old.storage_path]); return json(res,200,{ok:true});
    }
    return json(res,400,{error:'Ação administrativa inválida.'});
  }catch(error){ console.error('Lux Decor admin API:',error); return json(res,500,{error:'Erro interno no painel administrativo.'}); }
}
