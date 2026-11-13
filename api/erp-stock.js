import {createClient} from '@supabase/supabase-js';
import {readErpProducts,summarizeLinkedProducts} from './_erp.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','public, s-maxage=45, stale-while-revalidate=120');
 if(req.method!=='GET')return res.status(405).json({error:'Método não permitido'});
 try{
  const url=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)return res.status(503).json({error:'Integração indisponível'});
  const sb=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const [erp,links]=await Promise.all([readErpProducts(sb),sb.from('luxdecor_erp_product_links').select('site_product_id,erp_product_id')]);
  if(links.error)throw links.error;
  return res.status(200).json({connected:true,revision:erp.revision,updatedAt:erp.updatedAt,products:summarizeLinkedProducts(erp.items,links.data)});
 }catch(e){console.error('Catálogo ERP:',e.message);return res.status(503).json({error:'Disponibilidade temporariamente indisponível'})}
}
