import React,{useEffect,useMemo,useState} from 'react';
import {adminErpIntegrationInfo,adminLinkErp,adminUnlinkErp} from '../services/catalog';
import './ErpIntegration.css';

const norm=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
const fmt=value=>Number(value).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export default function ErpIntegration({products=[]}){
 const [data,setData]=useState({erp:[],links:[],revision:0});
 const [loading,setLoading]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [query,setQuery]=useState(''),[status,setStatus]=useState('all');
 const [selection,setSelection]=useState({}),[approval,setApproval]=useState(null);
 const load=async()=>{setError('');setLoading(true);try{setData(await adminErpIntegrationInfo())}catch(e){setError(e.message)}finally{setLoading(false)}};
 useEffect(()=>{load()},[]);
 const erpMap=useMemo(()=>new Map((data.erp||[]).map(x=>[String(x.id),x])),[data.erp]);
 const linkedIds=useMemo(()=>new Set((data.links||[]).map(x=>String(x.erp_product_id))),[data.links]);
 const waiting=useMemo(()=>(data.erp||[]).filter(x=>x.publishOnSite&&!linkedIds.has(String(x.id))),[data.erp,linkedIds]);
 const filtered=useMemo(()=>products.filter(p=>{
  const links=(data.links||[]).filter(x=>String(x.site_product_id)===String(p.id));
  const match=norm([p.name,p.category,...links.map(x=>erpMap.get(String(x.erp_product_id))?.name)].join(' ')).includes(norm(query));
  return match&&(status==='all'||(status==='linked'&&links.length>0)||(status==='pending'&&links.length===0));
 }),[products,data.links,erpMap,query,status]);
 const approve=async()=>{
  if(!approval)return;
  setBusy(true);setError('');
  try{
   if(approval.remove)await adminUnlinkErp(approval.siteId,approval.erpId);
   else await adminLinkErp(approval.siteId,approval.erpId);
   setApproval(null);setSelection(v=>({...v,[approval.siteId]:''}));
   await load();
  }catch(e){setError(e.message)}finally{setBusy(false)}
 };
 const linked=(data.links||[]).length;
 return <main className="erp-review">
  <header className="erp-review-header">
   <div><span className="erp-review-overline">Painel administrativo / Catálogo</span><h2>Integração com o ERP</h2>
   <p>Confira cada variação de estoque e aprove seu vínculo com um produto do catálogo. Vincular não altera fotos ou descrições. Apenas itens liberados no ERP podem fornecer disponibilidade e preço.</p></div>
   <button type="button" className="erp-review-refresh" onClick={load} disabled={loading||busy}>{loading?'Atualizando...':'Atualizar informações'}</button>
  </header>
  {error&&<p className="erp-review-error" role="alert">{error}</p>}
  <div className="erp-review-metrics" aria-label="Resumo da integração">
   <div><strong>{products.length}</strong><span>Produtos no site</span></div>
   <div><strong>{(data.erp||[]).length}</strong><span>Variações no ERP</span></div>
   <div><strong>{linked}</strong><span>Vínculos aprovados</span></div>
   <div><strong>{waiting.length}</strong><span>Liberadas sem vínculo</span></div>
  </div>
  {!loading&&waiting.length>0&&<section className="erp-review-pending">
   <div><strong>Variações aguardando associação</strong><p>Estão autorizadas no ERP, mas ainda não foram associadas a um produto existente no catálogo.</p></div>
   <div className="erp-review-pending-items">{waiting.slice(0,10).map(x=><span key={x.id}>{x.name}</span>)}{waiting.length>10&&<small>+{waiting.length-10} outras variações</small>}</div>
  </section>}
  <div className="erp-review-controls">
   <label><span>Pesquisar produto</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Nome, modelo, categoria ou variação..." /></label>
   <label><span>Situação</span><select value={status} onChange={e=>setStatus(e.target.value)}><option value="all">Todos os produtos</option><option value="linked">Com vínculo</option><option value="pending">Sem vínculo</option></select></label>
  </div>
  {loading?<p className="erp-review-state">Consultando o ERP...</p>:
  <div className="erp-review-list">
   {filtered.map(p=>{
    const links=(data.links||[]).filter(x=>String(x.site_product_id)===String(p.id));
    const candidates=(data.erp||[]).filter(x=>!linkedIds.has(String(x.id))||links.some(l=>String(l.erp_product_id)===String(x.id)));
    const selected=selection[p.id]||'';
    const chosen=erpMap.get(String(selected));
    return <article className="erp-review-card" key={p.id}>
     <div className="erp-review-product">{p.image&&<img src={p.image} alt="" />}<div><strong>{p.name}</strong><small>{p.category||'Produto do catálogo'}</small><span className={links.length?'erp-review-pill is-linked':'erp-review-pill'}>{links.length?links.length+' variação(ões) associada(s)':'Aguardando associação'}</span></div></div>
     <div className="erp-review-detail">
      <div className="erp-review-linked">{links.length?links.map(l=>{
       const item=erpMap.get(String(l.erp_product_id));
       return <div className="erp-review-link" key={l.erp_product_id}>
        <div><strong>{item?.name||l.erp_product_id}</strong><small>{!item?'Variação indisponível no retorno do ERP':item.publishOnSite?'Liberada no ERP':'Não liberada no ERP'}{item&&' · '+(item.unknown?'Estoque a conferir':item.stock+' un.')}{item?.publishOnSite&&Number(item.price)>0?' · '+fmt(item.price):''}</small></div>
        <button type="button" disabled={busy} onClick={()=>setApproval({siteId:p.id,erpId:l.erp_product_id,remove:true,siteName:p.name,erpName:item?.name||l.erp_product_id})}>Desvincular</button>
       </div>;
      }):<p className="erp-review-muted">Nenhuma variação associada. Escolha abaixo uma variação correspondente.</p>}</div>
      <div className="erp-review-add">
       <select aria-label={'Variação do ERP para '+p.name} value={selected} onChange={e=>setSelection(v=>({...v,[p.id]:e.target.value}))}>
        <option value="">Selecionar variação do ERP</option>
        {candidates.filter(x=>!links.some(l=>String(l.erp_product_id)===String(x.id))).map(x=><option key={x.id} value={x.id}>{x.name} · {x.publishOnSite?'Liberada':'Não liberada'} · {x.unknown?'A conferir':x.stock+' un.'}</option>)}
       </select>
       <button type="button" disabled={!chosen||busy} onClick={()=>setApproval({siteId:p.id,erpId:selected,siteName:p.name,erpName:chosen?.name,publishOnSite:chosen?.publishOnSite,price:chosen?.price})}>Revisar vínculo</button>
      </div>
     </div>
    </article>;
   })}
   {!filtered.length&&<p className="erp-review-state">Nenhum produto encontrado. Experimente outro termo de busca.</p>}
  </div>}
  <p className="erp-review-footnote">Aprovar um vínculo não cria produtos novos automaticamente. Para novos modelos, cadastre primeiro o produto no catálogo e depois faça a associação. A liberação “Exibir no site” continua controlada no ERP.</p>
  {approval&&<div className="erp-review-dialog-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setApproval(null)}}>
   <section className="erp-review-dialog" role="dialog" aria-modal="true" aria-labelledby="erp-review-dialog-title">
    <h3 id="erp-review-dialog-title">{approval.remove?'Remover vínculo?':'Aprovar associação?'}</h3>
    <p><b>Produto do site:</b> {approval.siteName}</p><p><b>Variação no ERP:</b> {approval.erpName}</p>
    {!approval.remove&&!approval.publishOnSite&&<p className="erp-review-warning">Esta variação ainda não está liberada em “Exibir no site” no ERP. A associação não a publicará automaticamente.</p>}
    <p className="erp-review-dialog-note">Esta operação não altera o estoque físico, as imagens ou o cadastro original.</p>
    <div className="erp-review-dialog-actions"><button type="button" disabled={busy} onClick={()=>setApproval(null)}>Cancelar</button><button type="button" disabled={busy} onClick={approve}>{busy?'Salvando...':approval.remove?'Confirmar desvínculo':'Aprovar vínculo'}</button></div>
   </section>
  </div>}
 </main>;
}
