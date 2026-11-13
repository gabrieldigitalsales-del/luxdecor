import React,{useEffect,useMemo,useState} from 'react';
import {adminErpIntegrationInfo,adminLinkErp,adminUnlinkErp} from '../services/catalog';

export default function ErpIntegration({products=[]}){
 const [data,setData]=useState({erp:[],links:[],revision:0}),[loading,setLoading]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState(''),[selected,setSelected]=useState({}),[query,setQuery]=useState('');
 const load=async()=>{setError('');try{setData(await adminErpIntegrationInfo())}catch(e){setError(e.message)}finally{setLoading(false)}};
 useEffect(()=>{load()},[]);
 const erpMap=useMemo(()=>new Map(data.erp.map(x=>[x.id,x])),[data.erp]);
 const filtered=products.filter(p=>p.name.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')));
 const change=async(productId,erpId,remove=false)=>{if(!erpId)return;setBusy(productId+erpId);setError('');try{if(remove)await adminUnlinkErp(productId,erpId);else await adminLinkErp(productId,erpId);await load();setSelected(v=>({...v,[productId]:''}))}catch(e){setError(e.message)}finally{setBusy('')}};
 return <main className="erp-integration">
  <div className="erp-integration-head"><div><div className="eyebrow">Sincronização segura</div><h2>Integração com ERP</h2><p>Selecione as variações de estoque que correspondem a cada produto do site. As fotos, descrições e preços atuais são preservados. A disponibilidade será consultada automaticamente no ERP.</p></div><button className="admin-primary" onClick={load} disabled={loading}>Atualizar lista</button></div>
  {error&&<p role="alert" className="admin-notice">{error}</p>}
  {loading?<p>Consultando produtos do ERP...</p>:<><div className="erp-integration-summary"><b>{data.erp.length} variações no ERP</b><b>{products.length} produtos no site</b><b>{new Set(data.links.map(x=>x.site_product_id)).size} produtos vinculados</b></div><input className="erp-integration-search" placeholder="Buscar produto do site..." value={query} onChange={e=>setQuery(e.target.value)}/>
   <div className="erp-integration-list">{filtered.map(p=>{const linked=data.links.filter(x=>x.site_product_id===p.id);return <section key={p.id} className="erp-integration-row"><div className="erp-integration-product">{p.image&&<img src={p.image} alt=""/>}<div><strong>{p.name}</strong><small>{linked.length?linked.length+' variação(ões) vinculada(s)':'Não vinculado ao ERP'}</small></div></div>
   <div className="erp-integration-links">{linked.map(x=><span key={x.erp_product_id}>{erpMap.get(x.erp_product_id)?.name||x.erp_product_id}<button disabled={Boolean(busy)} title="Remover vínculo" onClick={()=>change(p.id,x.erp_product_id,true)}>×</button></span>)}</div>
   <div className="erp-integration-add"><select aria-label={'Variação ERP para '+p.name} value={selected[p.id]||''} onChange={e=>setSelected(v=>({...v,[p.id]:e.target.value}))}><option value="">Selecionar variação do ERP</option>{data.erp.filter(e=>!linked.some(x=>x.erp_product_id===e.id)).map(e=><option key={e.id} value={e.id}>{e.name}{e.unknown?' · quantidade pendente':' · '+e.stock+' un.'}</option>)}</select><button className="admin-primary" disabled={!selected[p.id]||Boolean(busy)} onClick={()=>change(p.id,selected[p.id])}>Vincular</button></div></section>})}</div>
   {!filtered.length&&<p>Nenhum produto encontrado.</p>}
  </>}
 </main>;
}
