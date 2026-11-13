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
  const p=byId.get(String(row.erp_product_id));if(!p)continue;
  const id=String(row.site_product_id), record=grouped[id]||(grouped[id]={siteProductId:id,linked:true,quantity:0,knownVariants:0,unknownVariants:0,variants:0});
  record.variants++;
  const notes=String(p.observacoes||p.notes||'');
  const known=!/quantidade n[aã]o informada/i.test(notes)&&Number.isFinite(Number(p.stock));
  if(known){record.quantity+=Math.max(0,Number(p.stock)||0);record.knownVariants++}
  else record.unknownVariants++;
 }
 return grouped;
}
