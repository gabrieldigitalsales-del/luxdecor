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
    promotionEnabled: row.promotion_enabled === true,
    desc: row.description || '',
    features: row.features || [],
    isActive: row.is_active !== false,
    sortOrder: row.sort_order || 0,
  };
};

// Modelos repetidos no catálogo representam um mesmo produto com variantes.
function combineErpAvailability(siteIds, availability){
 const found=siteIds.map(id=>availability[String(id)]).filter(Boolean);
 if(!found.length)return null;
 const unique=new Map();
 for(const item of found)for(const option of item.options||[]){
  if(!unique.has(String(option.id)))unique.set(String(option.id),option);
 }
 const options=[...unique.values()].sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'pt-BR',{numeric:true}));
 const priced=options.map(o=>o.price).filter(v=>Number.isFinite(Number(v))&&Number(v)>0);
 const unknownVariants=options.filter(v=>v.unknown).length;
 const knownVariants=options.length-unknownVariants;
 const quantity=options.reduce((sum,v)=>sum+(v.unknown?0:Math.max(0,Number(v.stock)||0)),0);
 const result={linked:true,options,variants:options.length,quantity,unknownVariants,knownVariants};
 if(options.length&&priced.length===options.length){
  const min=Math.min(...priced),max=Math.max(...priced);
  result.sitePrice=min;
  result.sitePriceLabel=(max>min?'A partir de ':'')+min.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
 }
 return result;
}
export function applyErpAvailability(products,availability){
 return products.map(p=>({...p,erpAvailability:combineErpAvailability(p.erpSiteIds||[p.id],availability)}));
}
function groupCatalogByModel(rows){
 const groups=new Map();
 const normalize=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLocaleLowerCase('pt-BR').replace(/\s+/g,' ');
 for(const row of rows){
  const product=toProduct(row),key=normalize(product.name);
  if(!key){continue}
  const existing=groups.get(key);
  if(!existing){groups.set(key,{...product,erpSiteIds:[product.id]});continue}
  // Preferimos o cadastro com melhor material visual; os demais permanecem no banco.
  const quality=p=>(p.images?.length||0)*10+(p.desc?.length||0)/50+(p.features?.length||0);
  const best=quality(product)>quality(existing)?product:existing;
  const images=[...new Set([...(existing.images||[]),...(product.images||[])].filter(Boolean))];
  const features=[...new Set([...(existing.features||[]),...(product.features||[])])];
  groups.set(key,{...best,images,image:best.image||images[0]||'',features,promotionEnabled:existing.promotionEnabled===true||product.promotionEnabled===true,erpSiteIds:[...existing.erpSiteIds,product.id],sortOrder:Math.min(existing.sortOrder,product.sortOrder)});
 }
 return [...groups.values()].sort((a,b)=>a.sortOrder-b.sortOrder);
}

export async function fetchCatalog() {
  if (!supabaseConfigured) return null;
  // Carrega catálogo e disponibilidade em paralelo para evitar espera sequencial.
  const [catalogResult,availability] = await Promise.all([
    supabase
      .from('luxdecor_products')
      .select('*, category:luxdecor_categories(id,name), product_images:luxdecor_product_images(id,url,sort_order,is_cover)')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false }),
    fetchErpAvailability().catch(error=>{console.warn('Disponibilidade ERP indisponível; catálogo preservado.',error.message);return {};}),
  ]);
  if (catalogResult.error) throw catalogResult.error;
  return applyErpAvailability(groupCatalogByModel(catalogResult.data||[]),availability);

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

export async function fetchErpAvailability(){
 const res=await fetch('/api/erp-stock',{cache:'no-store'});
 if(!res.ok)throw Error('Estoque do ERP temporariamente indisponível.');
 const data=await res.json();return data.products||{};
}
export async function adminErpIntegrationInfo(){return adminApi('erpIntegrationInfo');}
export async function adminLinkErp(siteProductId,erpProductId,options={}){return adminApi('erpLink',{siteProductId,erpProductId,...options});}
export async function adminUnlinkErp(siteProductId,erpProductId){return adminApi('erpUnlink',{siteProductId,erpProductId});}
export async function adminCreateErpDraft(erpProductId,product){return adminApi('erpCreateDraft',{erpProductId,...product});}
export async function adminReleaseErpLinked(siteProductId,confirmConsolidate=false){return adminApi('erpReleaseLinked',{siteProductId,confirmConsolidate});}

export async function getPromotion(){return adminApi('getPromotion');}
export async function savePromotion(promotion){return adminApi('savePromotion',{promotion});}
export async function fetchActivePromotion(){
 const response=await fetch('/api/promotion',{cache:'no-store'});
 if(!response.ok)throw new Error('Campanha indisponível.');
 const data=await response.json();
 return data.promotion||null;
}
export async function uploadPromotionImage(file){
 const up=await uploadWithSignedUrl(file,'luxdecor-site-assets','promocoes');
 return up.url;
}

export async function getAdminSession(){
  try{const r=await adminApi('session');return Boolean(r.authenticated)}catch{return false}
}
export async function adminLogin(password){return adminApi('login',{password});}
export async function adminLogout(){return adminApi('logout');}
export async function adminFetchProducts(){const r=await adminApi('products');return r.products||[];}

async function compressImage(file,role='product'){
  if(!file||!String(file.type||'').startsWith('image/'))return file;
  const max=role==='site'?1920:1400;
  const quality=role==='site'?0.77:0.74;
  // Fotos pequenas já otimizadas não precisam ser reprocessadas.
  if(file.type==='image/webp'&&file.size<110000)return file;
  try{
    const bitmap=await createImageBitmap(file);
    const scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height));
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(bitmap.width*scale));
    canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
    bitmap.close?.();
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',quality));
    // Não sacrificar qualidade se a economia de bytes for insignificante.
    if(!blob||blob.size>=file.size*0.92)return file;
    const name=String(file.name||'imagem').replace(/\.[^.]+$/,'')+'.webp';
    return new File([blob],name,{type:'image/webp',lastModified:Date.now()});
  }catch{return file}
}

async function uploadWithSignedUrl(file,bucket,folder){
  if(!supabaseConfigured) throw new Error('Supabase público não configurado no Vercel.');
  const optimized=await compressImage(file,bucket==='luxdecor-site-assets'?'site':'product');
  const signed=await adminApi('uploadUrl',{bucket,folder,fileName:optimized.name,contentType:optimized.type});
  const {error}=await supabase.storage.from(bucket).uploadToSignedUrl(signed.path,signed.token,optimized,{contentType:optimized.type||undefined,cacheControl:'31536000'});
  if(error) throw error;
  const {data}=supabase.storage.from(bucket).getPublicUrl(signed.path);
  return {url:data.publicUrl,path:signed.path};
}

export async function saveProduct(product,newFiles=[]){
  const requestedPublish=product.isActive!==false;
  // Novos rascunhos com fotos ainda não enviadas precisam ser criados ocultos:
  // só publicamos após todas as imagens e a capa estarem salvas.
  const stageHidden=requestedPublish&&newFiles.length>0&&(!product.id||product.isActive===false);
  const staged={...product,isActive:stageHidden?false:product.isActive,image:undefined,images:undefined};
  const {id}=await adminApi('saveProduct',{product:staged});
  const pendingBlobs=(product.images||[]).filter(x=>String(x).startsWith('blob:'));
  const chosenPendingIndex=String(product.image||'').startsWith('blob:')?pendingBlobs.indexOf(product.image):-1;
  const uploaded=[];
  for(let i=0;i<newFiles.length;i++){
    const up=await uploadWithSignedUrl(newFiles[i],'luxdecor-products',String(id));
    uploaded.push(up);
    await adminApi('addProductImage',{productId:id,url:up.url,path:up.path,sortOrder:100+i,isCover:false});
  }
  let cover=null;
  if(chosenPendingIndex>=0&&uploaded[chosenPendingIndex])cover=uploaded[chosenPendingIndex].url;
  else if(product.image&&/^https?:/.test(product.image))cover=product.image;
  else if(uploaded[0])cover=uploaded[0].url;
  if(cover)await adminApi('setCover',{productId:id,url:cover});
  if(stageHidden)await adminApi('saveProduct',{product:{...staged,id,isActive:true}});
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

// Importa o pacote preparado com nomes numerados, usando o acesso já autorizado do painel.
export async function importCatalogZip(zipFile,onProgress=()=>{}){
  if(!zipFile) throw new Error('Selecione o ZIP do catálogo.');
  const {default:JSZip}=await import('jszip');
  const zip=await JSZip.loadAsync(zipFile);
  const manifestFile=zip.file('catalogo.json');
  if(manifestFile){
    const catalog=JSON.parse(await manifestFile.async('string'));
    if(!Array.isArray(catalog)||catalog.length!==20) throw new Error('O catálogo deve conter 20 produtos.');
    const existing=await adminFetchProducts();
    let complete=0;
    for(const item of catalog){
      const source=zip.file(item.arquivo);
      if(!source||!item.nome) throw new Error('Arquivo de produto ausente: '+item.arquivo);
      let product=existing.find(p=>p.name===item.nome);
      const id=product?.id||(await adminApi('saveProduct',{product:{name:item.nome,category:item.categoria||'Outros',price:null,priceLabel:'Consulte valor',isActive:true,sortOrder:100+Number(item.numero),desc:'',features:[]}})).id;
      const blob=await source.async('blob');
      const photo=new File([blob],item.arquivo,{type:'image/jpeg'});
      onProgress({complete,total:20,name:item.nome});
      const up=await uploadWithSignedUrl(photo,'luxdecor-products',String(id));
      await adminApi('addProductImage',{productId:id,url:up.url,path:up.path,sortOrder:0,isCover:true});
      await adminApi('setCover',{productId:id,url:up.url});
      if(product){
        const previous=[...new Set([...(product.images||[]),product.image].filter(Boolean))];
        for(const url of previous){if(url!==up.url) await adminApi('removeProductImage',{productId:id,url});}
      }
      complete++;onProgress({complete,total:20,name:item.nome});
    }
    return complete;
  }
  const entries=Object.values(zip.files).filter(f=>!f.dir&&/\.(jpe?g|png|webp)$/i.test(f.name));
  const ordered=entries.map(f=>({file:f,number:Number(f.name.split('/').pop().match(/^(\d{2})-/)?.[1])})).sort((a,b)=>a.number-b.number);
  if(ordered.length!==27 || ordered.some((x,i)=>x.number!==i+1)) throw new Error('O ZIP precisa conter as 27 fotos numeradas de 01 a 27.');
  const items=await adminFetchProducts();
  const products=[...items].sort((a,b)=>(a.sortOrder??a.sort_order??999)-(b.sortOrder??b.sort_order??999));
  if(products.length!==27 || products.some((p,i)=>Number(p.sortOrder??p.sort_order)!==i+1)) throw new Error('O catálogo não contém os 27 produtos numerados de 1 a 27. Nenhuma imagem foi enviada.');
  let complete=0;
  for(let i=0;i<ordered.length;i++){
    const product=products[i];
    const entry=ordered[i].file;
    const binary=await entry.async('blob');
    const name=entry.name.split('/').pop();
    const f=new File([binary],name,{type:/\.png$/i.test(name)?'image/png':/\.webp$/i.test(name)?'image/webp':'image/jpeg'});
    onProgress({complete,total:27,name:product.name});
    const up=await uploadWithSignedUrl(f,'luxdecor-products',String(product.id));
    await adminApi('addProductImage',{productId:product.id,url:up.url,path:up.path,sortOrder:0,isCover:true});
    await adminApi('setCover',{productId:product.id,url:up.url});
    complete++;
    onProgress({complete,total:27,name:product.name});
  }
  return complete;
}
