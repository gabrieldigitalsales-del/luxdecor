import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {adminErpIntegrationInfo,adminLinkErp,adminUnlinkErp,adminCreateErpDraft} from '../services/catalog';
import './ErpIntegration.css';
import {sameErpModel,modelTokens} from '../utils/erpModel';

const norm=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
const fmt=value=>Number(value).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export default function ErpIntegration({products=[],onCatalogChange=()=>{},onEditDraft=()=>{}}){
 const [data,setData]=useState({erp:[],links:[],revision:0});
 const [loading,setLoading]=useState(true),[refreshing,setRefreshing]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const requestRef=useRef(null),mountedRef=useRef(true);
 const [query,setQuery]=useState(''),[status,setStatus]=useState('all'),[page,setPage]=useState(1);
 const [selection,setSelection]=useState({}),[approval,setApproval]=useState(null);
 const [manualFor,setManualFor]=useState(null),[manualQuery,setManualQuery]=useState(''),[manualVerified,setManualVerified]=useState(false);
 const [newDraft,setNewDraft]=useState(null),[draftName,setDraftName]=useState(''),[draftCategory,setDraftCategory]=useState('Sofás'),[draftDescription,setDraftDescription]=useState('');
 const load=useCallback(async(silent=false)=>{
  if(requestRef.current)return requestRef.current;
  if(!silent)setRefreshing(true);
  const req=adminErpIntegrationInfo().then(result=>{
   if(mountedRef.current){setData(result);setError('');setLoading(false)}
   return result;
  }).catch(err=>{if(mountedRef.current){setError(err.message||'Falha ao atualizar ERP');setLoading(false)}return null})
    .finally(()=>{requestRef.current=null;if(mountedRef.current)setRefreshing(false)});
  requestRef.current=req;return req;
 },[]);
 useEffect(()=>{
  mountedRef.current=true;load(true);
  const timer=setInterval(()=>{if(!document.hidden&&!busy&&!approval&&!newDraft)load(true)},120000);
  return()=>{mountedRef.current=false;clearInterval(timer)};
 },[load,busy,approval,newDraft]);
 useEffect(()=>{setPage(1)},[query,status]);
 const erpMap=useMemo(()=>new Map((data.erp||[]).map(x=>[String(x.id),x])),[data.erp]);
 const linksByProduct=useMemo(()=>{
  const index=new Map();
  for(const link of data.links||[]){const id=String(link.site_product_id);if(!index.has(id))index.set(id,[]);index.get(id).push(link)}
  return index;
 },[data.links]);
 const linkedIds=useMemo(()=>new Set((data.links||[]).map(x=>String(x.erp_product_id))),[data.links]);
 const availableErp=useMemo(()=>(data.erp||[]).filter(x=>!linkedIds.has(String(x.id))),[data.erp,linkedIds]);
 const waiting=useMemo(()=>(data.erp||[]).filter(x=>x.publishOnSite&&!linkedIds.has(String(x.id))),[data.erp,linkedIds]);
 const notReleased=useMemo(()=>(data.erp||[]).filter(x=>!x.publishOnSite),[data.erp]);
 const approvedLinks=useMemo(()=>(data.links||[]).filter(link=>erpMap.get(String(link.erp_product_id))?.publishOnSite===true).length,[data.links,erpMap]);
 const waitingGroups=useMemo(()=>{
  const groups=new Map();
  for(const item of waiting){
   const key=[norm(item.supplier),modelTokens(item.modelName||item.name)[0]||String(item.id)].join('::');
   if(!groups.has(key))groups.set(key,{...item,variants:[]});
   groups.get(key).variants.push(item);
  }
  return [...groups.values()];
 },[waiting]);
 const filtered=useMemo(()=>products.filter(p=>{
  const links=linksByProduct.get(String(p.id))||[];
  const match=norm([p.name,p.category,...links.map(x=>erpMap.get(String(x.erp_product_id))?.name)].join(' ')).includes(norm(query));
  return match&&(status==='all'||(status==='linked'&&links.length>0)||(status==='pending'&&links.length===0));
 }),[products,linksByProduct,erpMap,query,status]);
 const pageSize=10;
 const pages=Math.max(1,Math.ceil(filtered.length/pageSize));
 const visible=filtered.slice((Math.min(page,pages)-1)*pageSize,Math.min(page,pages)*pageSize);
 const approve=async()=>{
  if(!approval)return;
  setBusy(true);setError('');setNotice('');
  try{
   if(approval.remove)await adminUnlinkErp(approval.siteId,approval.erpId);
   else await adminLinkErp(approval.siteId,approval.erpId,approval.manual?{manual:true,confirmedSameModel:manualVerified,confirmedSiteName:approval.siteName}:{});
   setApproval(null);setSelection(v=>({...v,[approval.siteId]:''}));
   await load(true);setNotice(approval.remove?'Vínculo removido.':'Variação vinculada com sucesso.');
  }catch(e){setError(e.message)}finally{setBusy(false)}
 };
 const createDraft=async()=>{
  if(!newDraft)return;
  setBusy(true);setError('');
  try{const result=await adminCreateErpDraft(newDraft.id,{name:draftName,category:draftCategory,description:draftDescription});setNewDraft(null);await onCatalogChange();await load(true);onEditDraft(result.id)}
  catch(e){setError(e.message)}finally{setBusy(false)}
 };
 useEffect(()=>{
  if(!newDraft&&!approval&&!manualFor)return;
  const onKey=e=>{if(e.key==='Escape'&&!busy){setApproval(null);setNewDraft(null);setManualFor(null)}};
  window.addEventListener('keydown',onKey);
  return()=>window.removeEventListener('keydown',onKey);
 },[newDraft,approval,manualFor,busy]);
 const manualOptions=useMemo(()=>availableErp.filter(x=>norm([x.name,x.modelName,x.supplier,x.id].join(' ')).includes(norm(manualQuery))).slice(0,60),[availableErp,manualQuery]);
 const linked=(data.links||[]).length;
 return <main className="erp-review">
  <header className="erp-review-header">
   <div><span className="erp-review-overline">Painel administrativo / Catálogo</span><h2>Integração com o ERP</h2>
   <p>Cada produto mostra somente as variações de seu próprio modelo. A associação não altera fotos ou descrições; preço e disponibilidade dependem da liberação no ERP.</p></div>
   <button type="button" className="erp-review-refresh" onClick={()=>load(false)} disabled={refreshing||busy}>{refreshing?'Atualizando...':'Atualizar informações'}</button>
  </header>
  {error&&<p className="erp-review-error" role="alert">{error}</p>}
  {notice&&<p className="erp-review-notice" role="status">{notice}</p>}
  <div className="erp-review-metrics" aria-label="Resumo da integração">
   <div><strong>{products.length}</strong><span>Produtos no site</span></div>
   <div><strong>{(data.erp||[]).length}</strong><span>Variações no ERP</span></div>
   <div><strong>{linked}</strong><span>Vínculos cadastrados</span></div>
   <div><strong>{approvedLinks}</strong><span>Vínculos liberados no ERP</span></div>
   <div><strong>{notReleased.length}</strong><span>Variações aguardando liberação</span></div>
  </div>
  {!loading&&notReleased.length>0&&<section className="erp-review-permissions" role="status">
   <strong>{notReleased.length} variações ainda não estão liberadas para o site</strong>
   <p>O estoque contém essas variações, mas elas precisam da marcação “Exibir no site” no cadastro do ERP. O vínculo existente, sozinho, não libera preço e disponibilidade. Não alteramos essas permissões automaticamente.</p>
  </section>}
  {!loading&&waiting.length>0&&<section className="erp-review-pending">
   <div><strong>Fila de aprovação do ERP</strong><p>Itens liberados no ERP que ainda não pertencem a um produto do site. Associe uma variação a um produto existente abaixo ou crie um rascunho para preparar fotos e publicação.</p></div>
   <div className="erp-review-queue">{waitingGroups.map(x=><div key={x.id} className="erp-review-queue-row">
    <div><strong>{x.modelName||x.name}</strong><small>{x.supplier?x.supplier+' · ':''}{x.variants.length} {x.variants.length===1?'variação':'variações'} do mesmo modelo</small></div>
    <button type="button" disabled={busy} onClick={()=>{setNewDraft(x);setDraftName(String(x.name||'').split(' · ')[0]);setDraftCategory(/sof[aá]|chaise/i.test(x.name)?'Sofás':'Outros');setDraftDescription('')}}>{x.variants.length===1?'Criar rascunho':'Importar modelo'}</button>
   </div>)}</div>
  </section>}
  <div className="erp-review-controls">
   <label><span>Pesquisar produto</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Nome, modelo, categoria ou variação..." /></label>
   <label><span>Situação</span><select value={status} onChange={e=>setStatus(e.target.value)}><option value="all">Todos os produtos</option><option value="linked">Com vínculo</option><option value="pending">Sem vínculo</option></select></label>
  </div>
  {loading?<p className="erp-review-state">Consultando o ERP...</p>:
  <div className="erp-review-list">
   {visible.map(p=>{
    const links=linksByProduct.get(String(p.id))||[];
    const candidates=availableErp.filter(x=>sameErpModel(p.name,x.modelName||x.name));
    const selected=selection[p.id]||'';
    const chosen=candidates.find(x=>String(x.id)===String(selected));
    return <article className="erp-review-card" key={p.id}>
     <div className="erp-review-product">{p.image&&<img src={p.image} alt="" />}<div><strong>{p.name}</strong><small>{p.category||'Produto do catálogo'}</small><span className={links.length?'erp-review-pill is-linked':'erp-review-pill'}>{links.length?links.length+' variação(ões) associada(s)':'Aguardando associação'}</span></div></div>
     <div className="erp-review-detail">
      <div className="erp-review-linked">{links.length?links.map(l=>{
       const item=erpMap.get(String(l.erp_product_id));
       return <div className="erp-review-link" key={l.erp_product_id}>
        <div><strong>{item?.name||l.erp_product_id}</strong>{item&&!sameErpModel(p.name,item.modelName||item.name)&&<small className="erp-review-model-warning">Vínculo antigo com outro modelo. Confira antes de manter.</small>}<small>{!item?'Variação indisponível no retorno do ERP':item.publishOnSite?'Liberada no ERP':'Não liberada no ERP'}{item&&' · '+(item.unknown?'Estoque a conferir':item.stock+' un.')}{item?.publishOnSite&&Number(item.price)>0?' · '+fmt(item.price):''}</small></div>
        <button type="button" disabled={busy} onClick={()=>setApproval({siteId:p.id,erpId:l.erp_product_id,remove:true,siteName:p.name,erpName:item?.name||l.erp_product_id})}>Desvincular</button>
       </div>;
      }):<p className="erp-review-muted">Nenhuma variação associada. Escolha abaixo uma variação correspondente.</p>}</div>
      <div className="erp-review-add">
       <select aria-label={'Variação do ERP para '+p.name} value={chosen?selected:''} disabled={busy||candidates.length===0} onChange={e=>setSelection(v=>({...v,[p.id]:e.target.value}))}>
        <option value="">{candidates.length?'Selecionar variação deste modelo':'Nenhuma variação deste modelo encontrada'}</option>
        {candidates.filter(x=>!links.some(l=>String(l.erp_product_id)===String(x.id))).map(x=><option key={x.id} value={x.id}>{x.name} · {x.publishOnSite?'Liberada':'Não liberada'} · {x.unknown?'A conferir':x.stock+' un.'}</option>)}
       </select>
       <button type="button" disabled={!chosen||!chosen.publishOnSite||busy} onClick={()=>setApproval({siteId:p.id,erpId:selected,siteName:p.name,erpName:chosen?.name,publishOnSite:chosen?.publishOnSite,price:chosen?.price})}>Revisar vínculo</button>
       <button type="button" className="erp-review-manual-button" disabled={busy} onClick={()=>{setManualFor({siteId:p.id,siteName:p.name});setManualQuery('')}}>Buscar variações manualmente</button>
       {chosen&&!chosen.publishOnSite&&<small className="erp-review-model-hint">Esta variação existe no ERP, mas precisa ser marcada como “Exibir no site” para ser vinculada.</small>}{!candidates.length&&<small className="erp-review-model-hint">Nenhuma correspondência automática. Use a busca manual para encontrar o item no ERP.</small>}
      </div>
     </div>
    </article>;
   })}
   {!filtered.length&&<p className="erp-review-state">Nenhum produto encontrado. Experimente outro termo de busca.</p>}
  </div>}
  {!loading&&pages>1&&<div className="erp-review-pagination"><span>{filtered.length} produtos encontrados · Página {Math.min(page,pages)} de {pages}</span><div><button type="button" disabled={page<=1} onClick={()=>setPage(n=>n-1)}>Anterior</button><button type="button" disabled={page>=pages} onClick={()=>setPage(n=>n+1)}>Próxima</button></div></div>}
  <p className="erp-review-footnote">A fila é atualizada ao consultar o ERP. Novos produtos entram como rascunho oculto: adicione imagens e confira os detalhes na aba Produtos antes de publicar. A liberação “Exibir no site” continua controlada no ERP.</p>
  {manualFor&&<div className="admin-editor-backdrop erp-review-dialog-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setManualFor(null)}}>
   <section className="admin-editor-v2 erp-review-dialog erp-review-manual-dialog" role="dialog" aria-modal="true" aria-labelledby="erp-manual-title">
    <h3 id="erp-manual-title">Localizar variação no ERP</h3>
    <p><b>Produto no site:</b> {manualFor.siteName}</p>
    <p className="erp-review-dialog-note">Pesquise por modelo, fábrica, cor, medida ou referência. Se o nome for diferente, confirme a identidade do produto antes de vincular.</p>
    <label className="erp-review-form-field">Pesquisar estoque ERP<input value={manualQuery} onChange={e=>setManualQuery(e.target.value)} placeholder="Ex.: Camaro, Luart, AB201..." autoFocus /></label>
    <div className="erp-review-manual-results">{manualOptions.map(item=><div className="erp-review-manual-option" key={item.id}><div><strong>{item.name}</strong><small>{item.supplier||'Fábrica não informada'} · {item.publishOnSite?'Liberado para o site':'Não liberado no ERP'}</small></div><button type="button" disabled={busy||!item.publishOnSite} onClick={()=>{setApproval({siteId:manualFor.siteId,siteName:manualFor.siteName,erpId:item.id,erpName:item.name,manual:true,needsConfirmation:!sameErpModel(manualFor.siteName,item.modelName||item.name),publishOnSite:item.publishOnSite});setManualVerified(false);setManualFor(null)}}>Selecionar</button></div>)}{manualOptions.length===0&&<p className="erp-review-state">Nenhuma variação disponível com essa pesquisa. Verifique se o item está cadastrado no ERP.</p>}</div>
    <div className="erp-review-dialog-actions"><button type="button" onClick={()=>setManualFor(null)}>Fechar</button></div>
   </section>
  </div>}
  {newDraft&&<div className="admin-editor-backdrop erp-review-dialog-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setNewDraft(null)}}>
   <section className="admin-editor-v2 erp-review-dialog" role="dialog" aria-modal="true" aria-labelledby="erp-draft-title">
    <h3 id="erp-draft-title">Preparar produto do ERP</h3>
    <p className="erp-review-dialog-note">{newDraft.variants?.length||1} variação(ões) do mesmo modelo serão reunidas em um único produto.</p>
    <p className="erp-review-dialog-note">Será criado um rascunho oculto. A publicação só acontece depois que você editar e ativar o produto na aba Produtos.</p>
    <label className="erp-review-form-field">Nome do produto<input maxLength={160} value={draftName} onChange={e=>setDraftName(e.target.value)}/></label>
    <label className="erp-review-form-field">Categoria<select value={draftCategory} onChange={e=>setDraftCategory(e.target.value)}><option>Sofás</option><option>Poltronas</option><option>Mesas</option><option>Cadeiras</option><option>Sala de jantar</option><option>Área externa</option><option>Banquetas</option><option>Aparadores</option><option>Espelhos</option><option>Outros</option></select></label>
    <label className="erp-review-form-field">Descrição inicial<textarea rows={3} value={draftDescription} onChange={e=>setDraftDescription(e.target.value)} placeholder="Opcional; pode ser preenchida na edição"/></label>
    <div className="erp-review-dialog-actions"><button type="button" disabled={busy} onClick={()=>setNewDraft(null)}>Cancelar</button><button type="button" disabled={busy||draftName.trim().length<2} onClick={createDraft}>{busy?'Criando...':'Criar rascunho oculto'}</button></div>
   </section>
  </div>}
  {approval&&<div className="erp-review-dialog-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setApproval(null)}}>
   <section className="erp-review-dialog" role="dialog" aria-modal="true" aria-labelledby="erp-review-dialog-title">
    <h3 id="erp-review-dialog-title">{approval.remove?'Remover vínculo?':'Aprovar associação?'}</h3>
    <p><b>Produto do site:</b> {approval.siteName}</p><p><b>Variação no ERP:</b> {approval.erpName}</p>
    {!approval.remove&&approval.manual&&approval.needsConfirmation&&<label className="erp-review-manual-confirm"><input type="checkbox" checked={manualVerified} onChange={e=>setManualVerified(e.target.checked)}/><span>Conferi modelo, fábrica e referência. Confirmo que esta variação pertence ao mesmo produto exibido no site, mesmo com nomes diferentes.</span></label>}
    {!approval.remove&&!approval.publishOnSite&&<p className="erp-review-warning">Esta variação ainda não está liberada em “Exibir no site” no ERP. A associação não a publicará automaticamente.</p>}
    <p className="erp-review-dialog-note">Esta operação não altera o estoque físico, as imagens ou o cadastro original.</p>
    <div className="erp-review-dialog-actions"><button type="button" disabled={busy} onClick={()=>setApproval(null)}>Cancelar</button><button type="button" disabled={busy||(!approval.remove&&approval.needsConfirmation&&!manualVerified)} onClick={approve}>{busy?'Salvando...':approval.remove?'Confirmar desvínculo':'Aprovar vínculo'}</button></div>
   </section>
  </div>}
 </main>;
}
