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

async function adminApi(action,payload={}){
  const res=await fetch('/api/admin',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({action,...payload})});
  const data=await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.error||'Falha no painel administrativo.');
  return data;
}

export async function getAdminSession(){
  try{const r=await adminApi('session');return Boolean(r.authenticated)}catch{return false}
}
export async function adminLogin(password){return adminApi('login',{password});}
export async function adminLogout(){return adminApi('logout');}
export async function adminFetchProducts(){const r=await adminApi('products');return r.products||[];}

async function uploadWithSignedUrl(file,bucket,folder){
  if(!supabaseConfigured) throw new Error('Supabase público não configurado no Vercel.');
  const signed=await adminApi('uploadUrl',{bucket,folder,fileName:file.name,contentType:file.type});
  const {error}=await supabase.storage.from(bucket).uploadToSignedUrl(signed.path,signed.token,file,{contentType:file.type||undefined,cacheControl:'3600'});
  if(error) throw error;
  const {data}=supabase.storage.from(bucket).getPublicUrl(signed.path);
  return {url:data.publicUrl,path:signed.path};
}

export async function saveProduct(product,newFiles=[]){
  const {id}=await adminApi('saveProduct',{product:{...product,image:undefined,images:undefined}});
  const pendingBlobs=(product.images||[]).filter(x=>String(x).startsWith('blob:'));
  const chosenPendingIndex=String(product.image||'').startsWith('blob:')?pendingBlobs.indexOf(product.image):-1;
  const uploaded=[];
  for(let i=0;i<newFiles.length;i++){
    const up=await uploadWithSignedUrl(newFiles[i],'products',String(id));
    uploaded.push(up);
    await adminApi('addProductImage',{productId:id,url:up.url,path:up.path,sortOrder:100+i,isCover:false});
  }
  let cover=null;
  if(chosenPendingIndex>=0 && uploaded[chosenPendingIndex]) cover=uploaded[chosenPendingIndex].url;
  else if(product.image && /^https?:/.test(product.image)) cover=product.image;
  else if(uploaded[0]) cover=uploaded[0].url;
  if(cover) await adminApi('setCover',{productId:id,url:cover});
  return id;
}

export async function setProductCover(productId,url){return adminApi('setCover',{productId,url});}
export async function deleteProduct(productId){return adminApi('deleteProduct',{productId});}
export async function saveSettings(settings){return adminApi('saveSettings',{settings:{whatsapp:settings.whatsapp,instagram:settings.instagram}});}

export async function replaceSiteImage(key,file){
  const up=await uploadWithSignedUrl(file,'site-assets',key);
  await adminApi('replaceSiteImage',{key,url:up.url,path:up.path});
  return up.url;
}
