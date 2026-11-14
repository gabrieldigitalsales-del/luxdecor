import {createClient} from '@supabase/supabase-js';
export default async function handler(req,res){
 if(req.method!=='GET')return res.status(405).json({error:'Método não permitido'});
 res.setHeader('Cache-Control','public, s-maxage=30, stale-while-revalidate=60');
 try{
  const url=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)return res.status(200).json({promotion:null});
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await db.from('luxdecor_promotion_popup').select('*').eq('id',1).maybeSingle();
  if(error)throw error;
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  if(!data?.enabled||(data.starts_on&&today<data.starts_on)||(data.ends_on&&today>data.ends_on))
   return res.status(200).json({promotion:null});
  const {enabled,occasion,headline,description,button_text,button_link,image_url,updated_at}=data;
  return res.status(200).json({promotion:{enabled,occasion,headline,description,button_text,button_link,image_url,updated_at}});
 }catch(e){console.error('Campanha Lux Decor:',e.message);return res.status(503).json({error:'Campanha indisponível'})}
}
