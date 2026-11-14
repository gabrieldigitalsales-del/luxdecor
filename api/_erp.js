// Leitura estritamente limitada ao documento de produtos do ERP; nunca devolve clientes, financeiro ou credenciais.
export const ERP_TENANT='5d194748-85c7-469c-92e5-83afdc0bc7b3';
export const ERP_KEY='luxdecor-products-v12';
export async function readErpProducts(sb){
 const {data,error}=await sb.from('erpluxdecor_documents').select('document_value,revision,updated_at').eq('tenant_owner_id',ERP_TENANT).eq('document_key',ERP_KEY).maybeSingle();
 if(error)throw error;
 if(!data)return {items:[],revision:0,updatedAt:null};
 let value=data.document_value;
 if(typeof value==='string')value=JSON.parse(value);
 if(!Array.isArray(value))throw new Error('Formato do estoque ERP inválido.');
 return {items:value.filter(p=>p&&typeof p==='object'),revision:data.revision||0,updatedAt:data.updated_at};
}
export const erpLabel=p=>[p.nome_produto||p.name||'Produto',p.variante||'',p.cor_acabamento||p.color||'',p.sku_ref||p.sku||''].filter(Boolean).join(' · ');
export function summarizeLinkedProducts(items,links){
 const byId=new Map(items.map(p=>[String(p.id),p]));
 const grouped={};
 for(const row of links||[]){
  const p=byId.get(String(row.erp_product_id));if(!p||p.publishOnSite!==true||p.active===false||p.archivedAt)continue;
  const id=String(row.site_product_id), record=grouped[id]||(grouped[id]={siteProductId:id,linked:true,quantity:0,knownVariants:0,unknownVariants:0,variants:0});
  record.variants++;
  const rawPrice=p.preco_final??p.price;
  const optionPrice=rawPrice===null||rawPrice===undefined||rawPrice===''?null:Number(rawPrice);
  const label=String(p.sizeLabel||p.variant||p.variante||p.width||'').trim();
  const color=String(p.color||p.cor_acabamento||p.finish||'').trim();
  const sku=String(p.sku||p.sku_ref||'').trim();
  (record.options||(record.options=[])).push({
   id:String(p.id),size:label,color,sku,
   name:[label,color].filter(Boolean).join(' · ')||'Variação padrão',
   price:Number.isFinite(optionPrice)&&optionPrice>0?Number(optionPrice.toFixed(2)):null,
   stock:Math.max(0,Number(p.stock)||0),
   unknown:/quantidade n[aã]o informada/i.test(String(p.observacoes||p.notes||'')),
  });
  const notes=String(p.observacoes||p.notes||'');
  const known=!/quantidade n[aã]o informada/i.test(notes)&&Number.isFinite(Number(p.stock));
  if(known){record.quantity+=Math.max(0,Number(p.stock)||0);record.knownVariants++}
  else record.unknownVariants++;
  // Nunca publicar preços de itens não autorizados ou sem valor válido.
  if(p.publishOnSite===true && p.active!==false && !p.archivedAt){
   record.enabledVariants=(record.enabledVariants||0)+1;
   const rawPrice=p.preco_final??p.price;
   const price=rawPrice===null||rawPrice===undefined||rawPrice===''?NaN:Number(rawPrice);
   if(Number.isFinite(price)&&price>0){
    (record.enabledPrices||(record.enabledPrices=[])).push(Number(price.toFixed(2)));
   }
  }
 }
 for(const record of Object.values(grouped)){
  record.options=(record.options||[]).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR',{numeric:true}));
  const prices=record.enabledPrices||[];
  // Para não informar preços incorretos, todas as variantes autorizadas devem ter preço.
  if(record.enabledVariants>0 && prices.length===record.enabledVariants){
   const min=Math.min(...prices),max=Math.max(...prices);
   record.sitePrice=min;
   record.sitePriceLabel=(max>min?'A partir de ':'')+min.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  }
  delete record.enabledPrices;
 }
 return grouped;
}
