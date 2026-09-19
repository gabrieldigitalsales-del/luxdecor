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
    .from('luxdecor_products')
    .select('*, category:luxdecor_categories(id,name), product_images:luxdecor_product_images(id,url,sort_order,is_cover)')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(toProduct);
}

export async function fetchSiteSettings() {
  if (!supabaseConfigured) return null;
  const [{data:settings,error:sErr},{data:images,error:iErr}] = await Promise.all([
    supabase.from('luxdecor_site_settings').select('*').eq('id',1).maybeSingle(),
    supabase.from('luxdecor_site_images').select('key,url')
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
    const up=await uploadWithSignedUrl(newFiles[i],'luxdecor-products',String(id));
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


export async function removeProductImage(productId,url){return adminApi('removeProductImage',{productId,url});}

function fileToAnalysisDataUrl(file){
  return new Promise((resolve,reject)=>{
    const img=new Image();
    const objectUrl=URL.createObjectURL(file);
    img.onload=()=>{
      try{
        const max=1100;
        const scale=Math.min(1,max/Math.max(img.width,img.height));
        const canvas=document.createElement('canvas');
        canvas.width=Math.max(1,Math.round(img.width*scale));
        canvas.height=Math.max(1,Math.round(img.height*scale));
        const ctx=canvas.getContext('2d');
        ctx.drawImage(img,0,0,canvas.width,canvas.height);
        URL.revokeObjectURL(objectUrl);
        resolve(canvas.toDataURL('image/jpeg',0.8));
      }catch(e){URL.revokeObjectURL(objectUrl);reject(e)}
    };
    img.onerror=()=>{URL.revokeObjectURL(objectUrl);reject(new Error('Não foi possível preparar a imagem.'))};
    img.src=objectUrl;
  });
}

const cleanOllamaUrl=(url='http://localhost:11434')=>String(url||'http://localhost:11434').trim().replace(/\/$/,'');

export async function checkOllama({url='http://localhost:11434'}={}){
  const base=cleanOllamaUrl(url);
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),2500);
  try{
    const res=await fetch(`${base}/api/tags`,{signal:controller.signal});
    if(!res.ok) throw new Error(`Ollama respondeu ${res.status}`);
    const data=await res.json();
    return {online:true,models:(data.models||[]).map(m=>m.name).filter(Boolean)};
  }catch(err){
    const msg=err?.name==='AbortError'?'O Ollama não respondeu a tempo.':(err?.message||'Ollama indisponível.');
    return {online:false,models:[],error:msg};
  }finally{clearTimeout(timer)}
}

function parseJsonLoose(text){
  const cleaned=String(text||'').trim().replace(/^```json\s*/i,'').replace(/^```\s*/,'').replace(/```$/,'').trim();
  try{return JSON.parse(cleaned)}catch{}
  const a=cleaned.indexOf('{'), b=cleaned.lastIndexOf('}');
  if(a>=0&&b>a){try{return JSON.parse(cleaned.slice(a,b+1))}catch{}}
  throw new Error('A IA local respondeu em um formato inesperado.');
}

export async function classifyProductImage(file,{url='http://localhost:11434',model='gemma3:4b'}={}){
  if(!file) throw new Error('Selecione uma imagem.');
  const imageDataUrl=await fileToAnalysisDataUrl(file);
  const base64=imageDataUrl.split(',')[1]||'';
  const base=cleanOllamaUrl(url);
  const prompt=`Você organiza o catálogo premium de uma loja brasileira de móveis chamada Lux Decor. Analise a foto e retorne SOMENTE JSON válido, sem markdown, neste formato: {"category":"Sofás|Mesas|Cadeiras|Sala de jantar|Área externa|Banquetas|Aparadores|Espelhos|Outros","name":"nome curto do produto","tag":"selo curto","description":"descrição comercial objetiva em português","features":["característica 1","característica 2","característica 3","característica 4"],"confidence":0.0}. Não invente preço, medida, material ou especificação técnica que não esteja visualmente clara. Se houver um ambiente com vários móveis, classifique o item predominante.`;
  let res;
  try{
    res=await fetch(`${base}/api/chat`,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        model,
        stream:false,
        format:'json',
        messages:[{role:'user',content:prompt,images:[base64]}],
        options:{temperature:0.15}
      })
    });
  }catch(err){
    throw new Error('Não foi possível acessar o Ollama local. Deixe o Ollama aberto e libere a origem do site em OLLAMA_ORIGINS.');
  }
  const data=await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data?.error||`Ollama respondeu ${res.status}.`);
  const text=data?.message?.content||data?.response||'';
  return {suggestion:parseJsonLoose(text)};
}

export async function replaceSiteImage(key,file){
  const up=await uploadWithSignedUrl(file,'luxdecor-site-assets',key);
  await adminApi('replaceSiteImage',{key,url:up.url,path:up.path});
  return up.url;
}
