import React,{useEffect,useState} from 'react';
import {getPromotion,savePromotion,uploadPromotionImage} from '../services/catalog';
import './PromotionManager.css';

export const PROMOTIONS=[
 ['dia-das-maes','Dia das Mães','Um presente especial para quem transforma uma casa em lar.'],
 ['dia-dos-pais','Dia dos Pais','Design e conforto para celebrar quem sempre está presente.'],
 ['black-friday','Black Friday','A temporada de oportunidades chegou à Lux Decor.'],
 ['natal','Natal','Prepare sua casa para receber os melhores momentos.'],
 ['ano-novo','Ano Novo','Um novo ano, novas inspirações para o seu lar.'],
 ['dia-dos-namorados','Dia dos Namorados','Ambientes especiais para viver grandes histórias.'],
 ['dia-das-criancas','Dia das Crianças','Mais conforto para os momentos em família.'],
 ['pascoa','Páscoa','Celebre novos encontros em ambientes acolhedores.'],
 ['dia-da-mulher','Dia da Mulher','Ambientes pensados para histórias extraordinárias.'],
 ['carnaval','Carnaval','Seu descanso merece um espaço cheio de personalidade.'],
 ['dia-do-consumidor','Dia do Consumidor','Uma oportunidade especial para renovar sua casa.'],
 ['dia-do-trabalho','Dia do Trabalho','Depois de um dia de trabalho, todo conforto faz diferença.'],
 ['festas-juninas','Festas Juninas','Sua casa pronta para receber e celebrar.'],
 ['primavera','Primavera','Renove seus espaços com leveza e design.'],
 ['inverno','Campanha de Inverno','Aconchego e elegância para a estação.'],
 ['verao','Campanha de Verão','Mais leveza e frescor para seus ambientes.'],
 ['cyber-monday','Cyber Monday','Mais uma oportunidade para descobrir nossa coleção.'],
 ['aniversario','Aniversário Lux Decor','Estamos celebrando mais um capítulo dessa história.'],
 ['queima-estoque','Queima de Estoque','Peças selecionadas com condições especiais.'],
 ['personalizada','Campanha personalizada','Uma seleção especial para transformar seu ambiente.'],
];
export const blankPromotion={
 enabled:false,occasion:'black-friday',headline:'Black Friday Lux Decor',
 description:'A temporada de oportunidades chegou à Lux Decor. Confira nossa seleção especial.',
 button_text:'Ver coleção',button_link:'#catalogo',image_url:'',starts_on:'',ends_on:'',
};
const toTitle=label=>label==='Black Friday'?'Black Friday Lux Decor':label+' na Lux Decor';
export default function PromotionManager(){
 const [form,setForm]=useState(blankPromotion),[initial,setInitial]=useState(true),[busy,setBusy]=useState(false);
 const [note,setNote]=useState(''),[error,setError]=useState(''),[preview,setPreview]=useState(false);
 useEffect(()=>{let active=true;getPromotion().then(r=>{if(active&&r.promotion)setForm({...blankPromotion,...r.promotion,starts_on:r.promotion.starts_on||'',ends_on:r.promotion.ends_on||''})}).catch(e=>active&&setError(e.message)).finally(()=>active&&setInitial(false));return()=>{active=false}},[]);
 const update=(field,value)=>{setForm(f=>({...f,[field]:value}));setNote('');setError('')};
 const choose=(id)=>{
  const item=PROMOTIONS.find(x=>x[0]===id)||PROMOTIONS[PROMOTIONS.length-1];
  setForm(f=>({...f,occasion:id,headline:toTitle(item[1]),description:item[2]}));
  setNote('');
 };
 const upload=async(event)=>{
  const file=event.target.files?.[0];event.target.value='';if(!file)return;
  setBusy(true);setError('');setNote('');
  try{const url=await uploadPromotionImage(file);setForm(f=>({...f,image_url:url}));setNote('Imagem enviada. Clique em Salvar campanha para aplicar.')}
  catch(e){setError(e.message)}
  finally{setBusy(false)}
 };
 const save=async()=>{
  if(!form.headline.trim()||!form.description.trim()||!form.button_text.trim())return setError('Preencha título, mensagem e texto do botão.');
  if(form.starts_on&&form.ends_on&&form.ends_on<form.starts_on)return setError('A data final precisa ser posterior à inicial.');
  setBusy(true);setError('');setNote('');
  try{const r=await savePromotion(form);setForm({...blankPromotion,...r.promotion,starts_on:r.promotion.starts_on||'',ends_on:r.promotion.ends_on||''});setNote('Campanha salva com sucesso. '+(r.promotion.enabled?'Ativada conforme o período configurado.':'Ela está desativada.'))}
  catch(e){setError(e.message)}
  finally{setBusy(false)}
 };
 return <main className="admin-workspace promo-manager">
  <div className="admin-title-row"><div><div className="eyebrow">Marketing</div><h2>Campanhas promocionais</h2><p>Configure um pop-up sazonal no site e escolha quando ele aparecerá. Nenhuma promoção é ativada automaticamente.</p></div></div>
  {initial?<div className="promo-loading" role="status">Carregando campanhas...</div>:<>
   {error&&<p role="alert" className="promo-message error">{error}</p>}
   {note&&<p role="status" className="promo-message success">{note}</p>}
   <div className="promo-manager-grid">
    <section className="promo-form-card">
     <div className="promo-form-head"><div><h3>Campanha atual</h3><p>Escolha a ocasião e personalize o texto.</p></div><label className="promo-switch"><input type="checkbox" checked={!!form.enabled} onChange={e=>update('enabled',e.target.checked)}/><span>{form.enabled?'Ativada':'Desativada'}</span></label></div>
     <label className="promo-field">Ocasião<select value={form.occasion} onChange={e=>choose(e.target.value)}>{PROMOTIONS.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
     <label className="promo-field">Título<input maxLength={120} value={form.headline||''} onChange={e=>update('headline',e.target.value)} placeholder="Ex.: Black Friday Lux Decor"/></label>
     <label className="promo-field">Mensagem<textarea maxLength={400} rows={3} value={form.description||''} onChange={e=>update('description',e.target.value)} placeholder="Apresente sua campanha sem prometer condições não configuradas."/></label>
     <div className="promo-fields-two"><label className="promo-field">Data de início<input type="date" value={form.starts_on||''} onChange={e=>update('starts_on',e.target.value)}/></label><label className="promo-field">Data final<input type="date" min={form.starts_on||undefined} value={form.ends_on||''} onChange={e=>update('ends_on',e.target.value)}/></label></div>
     <p className="promo-tip">Datas opcionais. Para campanhas com data móvel, como Páscoa e Dia das Mães, informe o período de cada ano.</p>
     <div className="promo-fields-two"><label className="promo-field">Texto do botão<input maxLength={45} value={form.button_text||''} onChange={e=>update('button_text',e.target.value)}/></label><label className="promo-field">Destino do botão<input maxLength={300} value={form.button_link||''} onChange={e=>update('button_link',e.target.value)} placeholder="#catalogo"/></label></div>
     <label className="promo-field">Imagem da campanha (opcional)<input type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} disabled={busy}/></label>
     {form.image_url&&<div className="promo-image-controls"><img src={form.image_url} alt="Imagem da campanha"/><button type="button" onClick={()=>update('image_url','')} disabled={busy}>Remover imagem</button></div>}
     <div className="promo-form-actions"><button type="button" className="promo-preview-button" onClick={()=>setPreview(true)}>Pré-visualizar</button><button type="button" className="admin-primary" disabled={busy} onClick={save}>{busy?'Salvando...':'Salvar campanha'}</button></div>
    </section>
    <aside className="promo-side"><span>Calendário de campanhas</span><div className="promo-occasion-list">{PROMOTIONS.map(([key,label])=><button key={key} type="button" className={form.occasion===key?'selected':''} onClick={()=>choose(key)}>{label}</button>)}</div><p>Ative apenas uma campanha por vez. Você pode trocar tema, texto, imagem e datas sempre que quiser.</p></aside>
   </div>
  </>}
  {preview&&<PromotionDialog promotion={form} preview onClose={()=>setPreview(false)}/>}
 </main>
}
export function PromotionDialog({promotion,onClose,preview=false}){
 useEffect(()=>{const key=e=>{if(e.key==='Escape')onClose()};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[onClose]);
 if(!promotion)return null;
 const destination=String(promotion.button_link||'#catalogo');
 return <div className="promo-dialog-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
  <section className={'promo-dialog '+(!promotion.image_url?'promo-dialog-no-image':'')} role="dialog" aria-modal="true" aria-labelledby="promo-dialog-title">
   <button type="button" className="promo-dialog-close" onClick={onClose} aria-label="Fechar promoção">×</button>
   {promotion.image_url&&<img className="promo-dialog-image" src={promotion.image_url} alt="" decoding="async"/>}
   <div className="promo-dialog-copy">
    <span className="promo-dialog-overline">LUX DECOR · CAMPANHA ESPECIAL</span>
    <h2 id="promo-dialog-title">{promotion.headline}</h2>
    <p>{promotion.description}</p>
    {preview?<button type="button" className="promo-dialog-cta" onClick={onClose}>{promotion.button_text||'Conhecer coleção'}</button>:<a className="promo-dialog-cta" href={destination} onClick={onClose} target={/^https:\/\//i.test(destination)?'_blank':undefined} rel={/^https:\/\//i.test(destination)?'noopener noreferrer':undefined}>{promotion.button_text||'Conhecer coleção'}</a>}
    <small>{preview?'Pré-visualização — ainda não publicado':'Condições e disponibilidade sob consulta.'}</small>
   </div>
  </section>
 </div>;
}
