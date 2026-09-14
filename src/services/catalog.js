import { supabase, supabaseConfigured } from '../lib/supabase';

const toProduct = (row) => {
  const ordered = [...(row.product_images || [])].sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));
  const images = ordered.map(x=>x.url).filter(Boolean);
  const cover = row.cover_url || images[0] || '';
  return {
    id: row.id,
    name: row.name,
    category: row.category?.name || row.category_name || 'Outros',
    categoryId: row.category_id,
    price: row.price,
    priceLabel: row.price_label || (row.price ? `R$ ${Number(row.price).toLocaleString('pt-BR',{minimumFractionDigits:2})}` : 'Sob consulta'),
    image: cover,
    images: images.length ? images : (cover ? [cover] : []),
    tag: row.badge || '',
    desc: row.description || '',
    features: row.features || [],
    isActive: row.is_active !== false,
    sortOrder: row.sort_order || 0,
  };
};

export async function fetchCatalog() {
  if (!supabaseConfigured) return null;
  const { data, error } = await supabase
    .from('products')
    .select('*, category:categories(id,name), product_images(id,url,sort_order,is_cover)')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(toProduct);
}

export async function fetchCategories() {
  if (!supabaseConfigured) return null;
  const { data, error } = await supabase.from('categories').select('*').eq('is_active', true).order('sort_order');
  if (error) throw error;
  return data || [];
}

export async function fetchSiteSettings() {
  if (!supabaseConfigured) return null;
  const [{data:settings,error:sErr},{data:images,error:iErr}] = await Promise.all([
    supabase.from('site_settings').select('*').eq('id',1).maybeSingle(),
    supabase.from('site_images').select('key,url')
  ]);
  if (sErr) throw sErr;
  if (iErr) throw iErr;
  return {
    whatsapp: settings?.whatsapp || '',
    instagram: settings?.instagram || '',
    siteImages: Object.fromEntries((images||[]).map(x=>[x.key,x.url])),
  };
}

export async function getSession() {
  if (!supabaseConfigured) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function signIn(email,password) {
  if (!supabaseConfigured) throw new Error('Supabase não configurado.');
  const { data, error } = await supabase.auth.signInWithPassword({email,password});
  if (error) throw error;
  return data;
}

export async function signOut() {
  if (!supabaseConfigured) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export function onAuthChange(cb){
  if (!supabaseConfigured) return { unsubscribe(){} };
  const { data } = supabase.auth.onAuthStateChange((_event,session)=>cb(session));
  return data.subscription;
}

async function ensureAdmin(){
  const { data:auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Faça login no Admin.');
  const { data, error } = await supabase.from('admin_users').select('user_id').eq('user_id',auth.user.id).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Este usuário não possui permissão de administrador.');
  return auth.user;
}

export async function adminFetchProducts(){
  await ensureAdmin();
  const {data,error}=await supabase.from('products').select('*, category:categories(id,name), product_images(id,url,storage_path,sort_order,is_cover)').order('sort_order').order('created_at',{ascending:false});
  if(error) throw error;
  return (data||[]).map(toProduct);
}

export async function uploadImage(file,bucket='products',folder='catalog'){
  await ensureAdmin();
  const ext=(file.name.split('.').pop()||'jpg').toLowerCase();
  const safe=crypto.randomUUID();
  const path=`${folder}/${new Date().toISOString().slice(0,10)}/${safe}.${ext}`;
  const {error}=await supabase.storage.from(bucket).upload(path,file,{cacheControl:'3600',upsert:false});
  if(error) throw error;
  const {data}=supabase.storage.from(bucket).getPublicUrl(path);
  return {url:data.publicUrl,path};
}

export async function saveProduct(product,newFiles=[]){
  await ensureAdmin();
  const payload={
    name:product.name.trim(),
    category_id:product.categoryId || null,
    category_name:product.category || null,
    price:product.price === '' || product.price == null ? null : Number(product.price),
    price_label:product.priceLabel || 'Sob consulta',
    description:product.desc || '',
    features:product.features || [],
    badge:product.tag || null,
    is_active:product.isActive !== false,
    sort_order:Number(product.sortOrder||0),
    updated_at:new Date().toISOString(),
  };
  let id=product.id;
  if(id){
    const {error}=await supabase.from('products').update(payload).eq('id',id); if(error) throw error;
  }else{
    const {data,error}=await supabase.from('products').insert(payload).select('id').single(); if(error) throw error; id=data.id;
  }
  for(const file of newFiles){
    const up=await uploadImage(file,'products',String(id));
    const {error}=await supabase.from('product_images').insert({product_id:id,url:up.url,storage_path:up.path,sort_order:100});
    if(error) throw error;
  }
  if(product.image && /^https?:/.test(product.image)){
    await supabase.from('products').update({cover_url:product.image}).eq('id',id);
  }
  return id;
}

export async function setProductCover(productId,url){
  await ensureAdmin();
  const {error}=await supabase.from('products').update({cover_url:url,updated_at:new Date().toISOString()}).eq('id',productId);
  if(error) throw error;
}

export async function deleteProduct(productId){
  await ensureAdmin();
  const {data:imgs}=await supabase.from('product_images').select('storage_path').eq('product_id',productId);
  const paths=(imgs||[]).map(x=>x.storage_path).filter(Boolean);
  if(paths.length) await supabase.storage.from('products').remove(paths);
  const {error}=await supabase.from('products').delete().eq('id',productId);
  if(error) throw error;
}

export async function saveSettings(settings){
  await ensureAdmin();
  const {error}=await supabase.from('site_settings').upsert({id:1,whatsapp:settings.whatsapp,instagram:settings.instagram,updated_at:new Date().toISOString()});
  if(error) throw error;
}

export async function replaceSiteImage(key,file){
  await ensureAdmin();
  const up=await uploadImage(file,'site-assets',key);
  const {data:old}=await supabase.from('site_images').select('storage_path').eq('key',key).maybeSingle();
  const {error}=await supabase.from('site_images').upsert({key,url:up.url,storage_path:up.path,updated_at:new Date().toISOString()});
  if(error) throw error;
  if(old?.storage_path) await supabase.storage.from('site-assets').remove([old.storage_path]);
  return up.url;
}
