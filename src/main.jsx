import React, {useEffect, useMemo, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import './styles.css';
import { supabaseConfigured } from './lib/supabase';
import {
  fetchCatalog,
  fetchSiteSettings,
  getSession,
  signIn,
  signOut,
  onAuthChange,
  adminFetchProducts,
  saveProduct,
  setProductCover,
  deleteProduct,
  saveSettings,
  replaceSiteImage,
} from './services/catalog';

const A='/assets/';
const INITIAL_PRODUCTS=[
  {id:1,name:'Mesa Off Laqueada',category:'Sala de jantar',price:null,priceLabel:'Sob consulta',image:A+'products/mesa-off.png',images:[A+'products/mesa-off.png',A+'products/mesa-telinha.png'],tag:'Destaque',desc:'Tampo e vidro laqueados, madeira chanfrada e base em madeira maciça. Um encontro entre natural e off.',features:['Tampo laqueado','Vidro laqueado','Base em madeira maciça','Acabamento natural + off']},
  {id:2,name:'Cadeira Natural',category:'Cadeiras',price:590,priceLabel:'R$ 590,00',image:A+'products/cadeira-madeira.png',images:[A+'products/cadeira-madeira.png'],tag:'Novo',desc:'Cadeira em madeira maciça natural, com desenho atemporal e estrutura que suporta até 120 kg.',features:['Madeira maciça','Suporta até 120 kg','Design atemporal','Uso residencial ou comercial']},
  {id:3,name:'Cadeira Náutica',category:'Área externa',price:null,priceLabel:'Sob consulta',image:A+'products/cadeira-corda.jpg',images:[A+'products/cadeira-corda.jpg',A+'products/mesa-demolicao.jpg'],tag:'Área externa',desc:'Corda náutica, braço em madeira maciça, estrutura preta e tecido resistente para área externa.',features:['Corda náutica','Braço em madeira maciça','Estrutura em alumínio','Tecido resistente']},
  {id:4,name:'Mesa Demolição 2×1',category:'Mesas',price:null,priceLabel:'Sob medida',image:A+'products/mesa-demolicao.jpg',images:[A+'products/mesa-demolicao.jpg',A+'products/cadeira-corda.jpg'],tag:'Sob medida',desc:'Madeira maciça modelo demolição com base em ferragem preta. Produzida também em medidas personalizadas.',features:['Madeira maciça','Ferragem preta','Modelo 2 × 1','Feita sob medida']},
  {id:5,name:'Sofá Cama D33',category:'Sofás',price:2699,priceLabel:'A partir de R$ 2.699',image:A+'products/sofa-cama.png',images:[A+'products/sofa-cama.png'],tag:'Conforto',desc:'Linho, espuma D33 e detalhes em couro ecológico com múltiplas opções de medidas.',features:['Espuma D33','Tecido em linho','Couro ecológico','Pés em madeira']},
  {id:6,name:'Sofá Retrátil 2,90 m',category:'Sofás',price:3990,priceLabel:'R$ 3.990',image:A+'products/sofa-vies.png',images:[A+'products/sofa-vies.png'],tag:'Mais vendido',desc:'Retrátil, reclinável e espuma D33 com costura em viés para um acabamento mais marcante.',features:['Retrátil','Reclinável','Espuma D33','Costura em viés']},
  {id:7,name:'Sofá Premium Cinza',category:'Sofás',price:2999,priceLabel:'A partir de R$ 2.999',image:A+'products/sofa-cinza.png',images:[A+'products/sofa-cinza.png'],tag:'Destaque',desc:'Estrutura reforçada, catraca blindada e acabamento pensado para uso diário.',features:['Espuma Sanka','Madeira maciça','Catraca blindada','Costura reforçada']},
  {id:8,name:'Mesa + Cadeiras Telinha',category:'Sala de jantar',price:998,priceLabel:'A partir de R$ 998',image:A+'products/mesa-telinha.png',images:[A+'products/mesa-telinha.png',A+'products/cadeira-telinha.png'],tag:'Composição',desc:'Conjunto visualmente leve, com tampo claro e cadeiras em polipropileno com trama telinha.',features:['Vidro laqueado','Madeira maciça','Polipropileno','Trama telinha']},
];

const SLIDE_COPY=[
  {eyebrow:'Coleção Lux Decor',title:'Móveis que fazem o ambiente falar por você.',text:'Design, matéria-prima e acabamento pensados para uma casa com presença.',cta:'Explorar catálogo',cat:'Todos'},
  {eyebrow:'Sala de estar',title:'Conforto com desenho e proporção.',text:'Sofás que unem estrutura, maciez e uma estética que permanece.',cta:'Ver sofás',cat:'Sofás'},
  {eyebrow:'Sala de jantar',title:'O lugar onde os encontros ganham forma.',text:'Mesas e cadeiras para composições leves, naturais e sofisticadas.',cta:'Ver sala de jantar',cat:'Sala de jantar'},
  {eyebrow:'Área externa',title:'Materiais certos para viver mais do lado de fora.',text:'Peças resistentes sem abrir mão do conforto ou do design.',cta:'Explorar área externa',cat:'Área externa'},
];

const DEFAULT_SITE_IMAGES={
  hero0:A+'products/mesa-off.png',
  hero1:A+'products/sofa-vies.png',
  hero2:A+'products/mesa-demolicao.jpg',
  hero3:A+'products/cadeira-corda.jpg',
  editorial:A+'products/mesa-off.png',
  roomDining:A+'products/mesa-off.png',
  roomLiving:A+'products/sofa-cinza.png',
  roomOutdoor:A+'products/cadeira-corda.jpg',
};
const DEFAULT_SETTINGS={whatsapp:'5531999999999',instagram:'https://www.instagram.com/luxdecor.sl/',siteImages:DEFAULT_SITE_IMAGES};

function WhatsAppIcon({size=20}){return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20.52 3.48A11.83 11.83 0 0 0 12.08 0C5.55 0 .24 5.31.24 11.84c0 2.09.55 4.13 1.6 5.93L.14 24l6.38-1.67a11.8 11.8 0 0 0 5.55 1.42h.01c6.52 0 11.83-5.31 11.83-11.84 0-3.16-1.2-6.14-3.39-8.43Z" stroke="currentColor" strokeWidth="1.45"/><path d="M18.4 14.67c-.35-.17-2.05-1.01-2.37-1.13-.32-.12-.55-.17-.78.17-.23.35-.9 1.13-1.1 1.36-.2.23-.4.26-.75.09-.35-.17-1.47-.54-2.8-1.73-1.04-.93-1.74-2.07-1.94-2.42-.2-.35-.02-.54.15-.71.16-.15.35-.4.52-.61.17-.2.23-.35.35-.58.12-.23.06-.43-.03-.61-.09-.17-.78-1.88-1.07-2.58-.28-.68-.57-.59-.78-.6h-.67c-.23 0-.61.09-.93.43-.32.35-1.22 1.19-1.22 2.9 0 1.71 1.25 3.36 1.42 3.59.17.23 2.46 3.76 5.96 5.27.83.36 1.48.57 1.99.73.84.27 1.6.23 2.2.14.67-.1 2.05-.84 2.34-1.65.29-.81.29-1.51.2-1.65-.08-.15-.31-.23-.66-.4Z" fill="currentColor"/></svg>}
function InstagramIcon({size=20}){return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.5" cy="6.6" r="1" fill="currentColor" stroke="none"/></svg>}
function SearchIcon(){return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>}
function HeartIcon({filled=false}){return <svg viewBox="0 0 24 24" width="19" height="19" fill={filled?'currentColor':'none'} stroke="currentColor" strokeWidth="1.7"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z"/></svg>}

function Brand({dark=false,compact=false}){return <div className={'brand '+(dark?'brand-dark':'')}><img src={dark?A+'logo-lockup-white.png':A+'logo-lockup-navy.png'} alt="Lux Decor" className={compact?'brand-img compact':'brand-img'}/></div>}

function App(){
 const [products,setProducts]=useState(()=>JSON.parse(localStorage.getItem('lux_products')||'null')||INITIAL_PRODUCTS);
 const [settings,setSettings]=useState(()=>{const saved=JSON.parse(localStorage.getItem('lux_settings')||'null')||{};return {...DEFAULT_SETTINGS,...saved,siteImages:{...DEFAULT_SITE_IMAGES,...(saved.siteImages||{})}}});
 const [slide,setSlide]=useState(0); const [filter,setFilter]=useState('Todos'); const [query,setQuery]=useState(''); const [selected,setSelected]=useState(null); const [favorites,setFavorites]=useState([]); const [admin,setAdmin]=useState(false); const [waOpen,setWaOpen]=useState(false);
 const [cloudState,setCloudState]=useState(supabaseConfigured?'loading':'local'); const [cloudMessage,setCloudMessage]=useState('');
 useEffect(()=>{let live=true;(async()=>{if(!supabaseConfigured)return;try{const [catalog,remoteSettings]=await Promise.all([fetchCatalog(),fetchSiteSettings()]);if(!live)return;if(catalog?.length)setProducts(catalog);if(remoteSettings)setSettings(prev=>({...prev,...remoteSettings,siteImages:{...DEFAULT_SITE_IMAGES,...(remoteSettings.siteImages||{})}}));setCloudState('online')}catch(e){console.error(e);if(live){setCloudState('error');setCloudMessage(e.message||'Não foi possível carregar o catálogo online.')}}})();return()=>{live=false}},[]);
 useEffect(()=>{const t=setInterval(()=>setSlide(s=>(s+1)%slides.length),6500);return()=>clearInterval(t)},[settings.siteImages]);
 useEffect(()=>{if(!supabaseConfigured)localStorage.setItem('lux_products',JSON.stringify(products))},[products]);
 useEffect(()=>{if(!supabaseConfigured)localStorage.setItem('lux_settings',JSON.stringify(settings))},[settings]);
 useEffect(()=>{if(location.hash==='#admin')setAdmin(true)},[]);
 const cats=['Todos','Sofás','Mesas','Cadeiras','Sala de jantar','Área externa'];
 const slides=useMemo(()=>SLIDE_COPY.map((x,i)=>({...x,image:settings.siteImages?.['hero'+i]||DEFAULT_SITE_IMAGES['hero'+i]})),[settings.siteImages]);
 const visible=useMemo(()=>products.filter(p=>(filter==='Todos'||p.category===filter)&&(!query||p.name.toLowerCase().includes(query.toLowerCase())||p.category.toLowerCase().includes(query.toLowerCase()))),[products,filter,query]);
 const wa=(text)=>`https://wa.me/${settings.whatsapp.replace(/\D/g,'')}?text=${encodeURIComponent(text)}`;
 const goCategory=(cat)=>{setFilter(cat);document.getElementById('catalogo')?.scrollIntoView({behavior:'smooth'})};
 return <div className="app-shell">
  <div className="announcement">Lux Decor <span/> Móveis, interiores e boas histórias</div>{cloudState==='error'&&<div className="cloud-warning">Catálogo em modo de segurança. {cloudMessage}</div>}
  <header className="site-header"><div className="header-inner">
   <button className="brand-button" onClick={()=>scrollTo({top:0,behavior:'smooth'})}><Brand/></button>
   <nav className="desktop-nav"><button onClick={()=>goCategory('Todos')}>Catálogo</button><button onClick={()=>goCategory('Sofás')}>Sofás</button><button onClick={()=>goCategory('Sala de jantar')}>Sala de jantar</button><button onClick={()=>goCategory('Área externa')}>Área externa</button></nav>
   <div className="header-actions"><a href={settings.instagram} target="_blank" rel="noreferrer" className="icon-btn" aria-label="Instagram"><InstagramIcon/></a><button className="icon-btn" onClick={()=>setFavorites(f=>f.length?[]:products.slice(0,2).map(p=>p.id))} aria-label="Favoritos"><HeartIcon filled={favorites.length>0}/></button><button className="admin-link" onClick={()=>setAdmin(true)}>Admin</button></div>
  </div></header>

  <main>
   <section className="hero" aria-label="Destaques Lux Decor">
    {slides.map((s,i)=><div key={i} className={'hero-slide '+(i===slide?'active':'')}><img src={s.image} alt=""/><div className="hero-shade"/></div>)}
    <img className="hero-mark" src={A+'logo-mark-white.png'} alt="" aria-hidden="true"/>
    <div className="hero-content"><div className="eyebrow light">{slides[slide].eyebrow}</div><h1>{slides[slide].title}</h1><p>{slides[slide].text}</p><div className="hero-actions"><button className="btn-light" onClick={()=>goCategory(slides[slide].cat)}>{slides[slide].cta}</button><a className="btn-ghost" href={wa('Olá! Quero conhecer os móveis da Lux Decor.')} target="_blank" rel="noreferrer"><WhatsAppIcon/> Falar com especialista</a></div></div>
    <div className="hero-nav"><button onClick={()=>setSlide((slide-1+slides.length)%slides.length)} aria-label="Anterior">←</button><div className="hero-dots">{slides.map((_,i)=><button key={i} className={i===slide?'active':''} onClick={()=>setSlide(i)} aria-label={`Slide ${i+1}`}/>)}</div><button onClick={()=>setSlide((slide+1)%slides.length)} aria-label="Próximo">→</button></div>
   </section>

   <section className="brand-strip"><div><span>01</span><b>Curadoria</b><small>Peças escolhidas pela presença e acabamento.</small></div><div><span>02</span><b>Atendimento</b><small>Consultoria direta para encontrar a composição certa.</small></div><div><span>03</span><b>Sob medida</b><small>Opções personalizadas em produtos selecionados.</small></div></section>

   <section className="intro"><div className="eyebrow">Lux Decor / Sete Lagoas</div><h2>Não vendemos apenas móveis.<br/><span>Construímos a atmosfera da casa.</span></h2><p>Um catálogo feito para descobrir peças, comparar materiais e chegar ao atendimento já sabendo o que combina com o seu ambiente.</p></section>

   <section id="catalogo" className="catalog-section"><div className="catalog-head"><div><div className="eyebrow">Catálogo</div><h2>Escolha pelo ambiente, material ou sensação.</h2></div><label className="search-box"><SearchIcon/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar produto..."/></label></div>
    <div className="filters">{cats.map(c=><button key={c} onClick={()=>setFilter(c)} className={filter===c?'active':''}>{c}</button>)}</div>
    <div className="product-grid">{visible.map((p,idx)=><article className="product-card" key={p.id} style={{'--delay':`${idx*35}ms`}}><div className="product-image-wrap" onClick={()=>setSelected(p)}><img src={p.image} alt={p.name}/><span className="product-tag">{p.tag}</span><button className="fav" onClick={(e)=>{e.stopPropagation();setFavorites(f=>f.includes(p.id)?f.filter(x=>x!==p.id):[...f,p.id])}}><HeartIcon filled={favorites.includes(p.id)}/></button></div><div className="product-info"><span>{p.category}</span><h3>{p.name}</h3><div className="price-line"><strong>{p.priceLabel}</strong><button onClick={()=>setSelected(p)}>Ver detalhes →</button></div></div></article>)}</div>
   </section>

   <section className="editorial"><div className="editorial-photo"><img src={settings.siteImages?.editorial||DEFAULT_SITE_IMAGES.editorial} alt="Ambiente de alto padrão Lux Decor"/></div><div className="editorial-copy"><div className="eyebrow">Matéria-prima</div><h2>Madeira natural.<br/>Texturas honestas.<br/>Design que fica.</h2><p>Peças com personalidade começam na escolha do material. Madeira maciça, tecidos resistentes, linho, corda náutica e estruturas pensadas para durar.</p><button onClick={()=>goCategory('Mesas')} className="text-link">Conhecer mesas <span>↗</span></button></div></section>

   <section className="rooms"><div className="section-title"><div className="eyebrow">Compre por ambiente</div><h2>Comece pelo lugar que você quer transformar.</h2></div><div className="room-grid"><button onClick={()=>goCategory('Sala de jantar')}><img src={settings.siteImages?.roomDining||DEFAULT_SITE_IMAGES.roomDining} alt="Sala de jantar"/><span>Sala de jantar <b>→</b></span></button><button onClick={()=>goCategory('Sofás')}><img src={settings.siteImages?.roomLiving||DEFAULT_SITE_IMAGES.roomLiving} alt="Sala de estar"/><span>Sala de estar <b>→</b></span></button><button onClick={()=>goCategory('Área externa')}><img src={settings.siteImages?.roomOutdoor||DEFAULT_SITE_IMAGES.roomOutdoor} alt="Área externa"/><span>Área externa <b>→</b></span></button></div></section>

   <section className="instagram-block"><div><InstagramIcon size={27}/><div><div className="eyebrow">Instagram</div><h2>@luxdecor.sl</h2></div></div><p>Novidades, composições e detalhes do showroom todos os dias.</p><a href={settings.instagram} target="_blank" rel="noreferrer">Acompanhar perfil →</a></section>
  </main>

  <footer><div className="footer-brand"><Brand dark/><p>Móveis que fazem bons momentos.</p></div><div><b>Catálogo</b><button onClick={()=>goCategory('Sofás')}>Sofás</button><button onClick={()=>goCategory('Sala de jantar')}>Sala de jantar</button><button onClick={()=>goCategory('Área externa')}>Área externa</button></div><div><b>Atendimento</b><a href={wa('Olá! Vim pelo site da Lux Decor e gostaria de atendimento.')} target="_blank" rel="noreferrer">WhatsApp</a><a href={settings.instagram} target="_blank" rel="noreferrer">Instagram</a></div><div className="footer-mark"><img src={A+'logo-mark-white.png'} alt=""/></div></footer>

  <button className="wa-float" onClick={()=>setWaOpen(!waOpen)} aria-label="Abrir WhatsApp"><WhatsAppIcon size={25}/><span>Falar com especialista</span></button>
  {waOpen&&<div className="wa-panel"><div className="wa-panel-head"><div><WhatsAppIcon/><b>Lux Decor</b></div><button onClick={()=>setWaOpen(false)}>×</button></div><p>Olá! Como podemos ajudar?</p><a href={wa('Olá! Quero saber mais sobre um produto da Lux Decor.')} target="_blank">Quero saber sobre um produto <span>→</span></a><a href={wa('Olá! Quero ajuda para montar um ambiente.')} target="_blank">Quero montar um ambiente <span>→</span></a><a href={wa('Olá! Gostaria de falar com um consultor da Lux Decor.')} target="_blank">Falar com consultor <span>→</span></a></div>}

  {selected&&<ProductModal p={selected} onClose={()=>setSelected(null)} wa={wa}/>} 
  {admin&&<AdminPanel products={products} setProducts={setProducts} settings={settings} setSettings={setSettings} onClose={()=>{setAdmin(false);history.replaceState(null,'',location.pathname)}}/>}
 </div>
}

function ProductModal({p,onClose,wa}){const [img,setImg]=useState(0);return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><div className="product-modal"><button className="modal-close" onClick={onClose}>×</button><div className="modal-gallery"><img className="modal-main-img" src={p.images[img]||p.image} alt={p.name}/>{p.images.length>1&&<div className="thumbs">{p.images.map((x,i)=><button className={i===img?'active':''} onClick={()=>setImg(i)} key={x+i}><img src={x} alt=""/></button>)}</div>}</div><div className="modal-copy"><div className="eyebrow">{p.category}</div><h2>{p.name}</h2><p className="modal-desc">{p.desc}</p><div className="modal-price">{p.priceLabel}</div><div className="feature-list">{p.features.map(x=><div key={x}><span>✓</span>{x}</div>)}</div><a className="wa-product" href={wa(`Olá! Estou vendo o produto ${p.name} no site da Lux Decor e gostaria de mais informações.`)} target="_blank" rel="noreferrer"><WhatsAppIcon/> Quero este produto</a><small>Você será atendido diretamente pela equipe Lux Decor.</small></div></div></div>}

function AdminPanel({products,setProducts,settings,setSettings,onClose}){
 const [session,setSession]=useState(null); const [checking,setChecking]=useState(supabaseConfigured); const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [authError,setAuthError]=useState('');
 const [draft,setDraft]=useState(null); const [pendingFiles,setPendingFiles]=useState([]); const fileRef=useRef(); const fixedRef=useRef(); const [fixedKey,setFixedKey]=useState(null); const [busy,setBusy]=useState(''); const [notice,setNotice]=useState('');
 const fixedImages=[['hero0','Hero 01'],['hero1','Hero 02'],['hero2','Hero 03'],['hero3','Hero 04'],['editorial','Imagem editorial central'],['roomDining','Ambiente · Sala de jantar'],['roomLiving','Ambiente · Sala de estar'],['roomOutdoor','Ambiente · Área externa']];
 useEffect(()=>{if(!supabaseConfigured){setChecking(false);return}let alive=true;getSession().then(s=>alive&&setSession(s)).finally(()=>alive&&setChecking(false));const sub=onAuthChange(s=>setSession(s));return()=>{alive=false;sub?.unsubscribe?.()}},[]);
 async function login(e){e.preventDefault();setAuthError('');setBusy('Entrando...');try{const {session}=await signIn(email,password);setSession(session)}catch(err){setAuthError(err.message)}finally{setBusy('')}}
 async function logout(){await signOut();setSession(null)}
 async function refresh(){const [ps,ss]=await Promise.all([adminFetchProducts(),fetchSiteSettings()]);if(ps?.length)setProducts(ps);if(ss)setSettings(prev=>({...prev,...ss,siteImages:{...DEFAULT_SITE_IMAGES,...(ss.siteImages||{})}}))}
 async function save(){if(!draft?.name)return;setBusy('Salvando produto...');setNotice('');try{if(supabaseConfigured){const id=await saveProduct(draft,pendingFiles);if(draft.image&&/^https?:/.test(draft.image))await setProductCover(id,draft.image);await refresh()}else{if(draft.id)setProducts(ps=>ps.map(p=>p.id===draft.id?draft:p));else setProducts(ps=>[...ps,{...draft,id:Date.now(),tag:draft.tag||'Novo',images:draft.images?.length?draft.images:[draft.image],features:draft.features||[]}])}setDraft(null);setPendingFiles([]);setNotice('Produto salvo.')}catch(e){setNotice(e.message)}finally{setBusy('')}}
 function files(e){const arr=[...e.target.files];setPendingFiles(arr);const previews=arr.map(URL.createObjectURL);setDraft(d=>({...d,image:d.image||previews[0]||'',images:[...(d.images||[]),...previews]}))}
 async function fixedFile(e){const f=e.target.files?.[0];if(!f||!fixedKey)return;setBusy('Enviando imagem...');try{if(supabaseConfigured){const url=await replaceSiteImage(fixedKey,f);setSettings(prev=>({...prev,siteImages:{...prev.siteImages,[fixedKey]:url}}))}else{const url=URL.createObjectURL(f);setSettings(prev=>({...prev,siteImages:{...prev.siteImages,[fixedKey]:url}}))}setNotice('Imagem atualizada.')}catch(err){setNotice(err.message)}finally{setBusy('');e.target.value='';setFixedKey(null)}}
 function chooseFixed(k){setFixedKey(k);setTimeout(()=>fixedRef.current?.click(),0)}
 async function remove(id){if(!confirm('Excluir este produto?'))return;setBusy('Excluindo...');try{if(supabaseConfigured){await deleteProduct(id);await refresh()}else setProducts(ps=>ps.filter(x=>x.id!==id));setNotice('Produto excluído.')}catch(e){setNotice(e.message)}finally{setBusy('')}}
 async function persistSettings(){setBusy('Salvando configurações...');try{if(supabaseConfigured)await saveSettings(settings);else localStorage.setItem('lux_settings',JSON.stringify(settings));setNotice('Configurações salvas.')}catch(e){setNotice(e.message)}finally{setBusy('')}}
 if(checking)return <div className="admin-overlay"><div className="admin-login"><Brand/><p>Conectando ao painel...</p></div></div>;
 if(supabaseConfigured&&!session)return <div className="admin-overlay"><div className="admin-login"><button className="modal-close" onClick={onClose}>×</button><Brand/><div className="eyebrow">Admin protegido</div><h2>Entrar na Lux Decor</h2><p>Use o usuário criado no Auth deste Supabase exclusivo.</p><form onSubmit={login}><label>E-mail<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label><label>Senha<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required/></label>{authError&&<div className="admin-error">{authError}</div>}<button className="save-btn" disabled={!!busy}>{busy||'Entrar'}</button></form></div></div>;
 return <div className="admin-overlay"><aside className="admin-panel"><div className="admin-head"><div><img src={A+'logo-mark-navy.png'} alt="Lux Decor"/><div><b>Painel Lux Decor</b><small>{supabaseConfigured?'Supabase exclusivo · online':'Modo local · configure o .env'}</small></div></div><div className="admin-head-actions">{session&&<button onClick={logout}>Sair</button>}<button onClick={onClose}>×</button></div></div>
 {notice&&<div className="admin-notice">{notice}</div>}{busy&&<div className="admin-busy">{busy}</div>}
 {!supabaseConfigured&&<div className="admin-setup-warning"><b>Supabase ainda não ligado.</b><span>Preencha VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no Vercel. O site público continua funcionando sem tela branca.</span></div>}
 <section><div className="admin-section-title"><h3>Configurações</h3><button onClick={persistSettings}>Salvar</button></div><label>WhatsApp<input value={settings.whatsapp||''} onChange={e=>setSettings({...settings,whatsapp:e.target.value})}/></label><label>Instagram<input value={settings.instagram||''} onChange={e=>setSettings({...settings,instagram:e.target.value})}/></label></section>
 <section><div className="admin-section-title"><div><h3>Imagens fixas do site</h3><small>Uploads permanentes no bucket site-assets</small></div></div><input ref={fixedRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={fixedFile}/><div className="fixed-image-grid">{fixedImages.map(([k,label])=><div className="fixed-image-card" key={k}><img src={settings.siteImages?.[k]||DEFAULT_SITE_IMAGES[k]} alt=""/><div><b>{label}</b><button onClick={()=>chooseFixed(k)}>Trocar imagem</button></div></div>)}</div></section>
 <section><div className="admin-section-title"><h3>Produtos</h3><button onClick={()=>setDraft({name:'',category:'Sala de jantar',categoryId:null,price:'',priceLabel:'Sob consulta',image:'',images:[],tag:'Novo',desc:'',features:[],isActive:true,sortOrder:0})}>+ Novo produto</button></div><div className="admin-products">{products.map(p=><div key={p.id}><img src={p.image}/><div><b>{p.name}</b><small>{p.priceLabel}</small></div><button onClick={()=>{setPendingFiles([]);setDraft({...p})}}>Editar</button><button className="danger" onClick={()=>remove(p.id)}>Excluir</button></div>)}</div></section>
 {draft&&<div className="admin-editor"><div className="admin-section-title"><h3>{draft.id?'Editar produto':'Novo produto'}</h3><button onClick={()=>{setDraft(null);setPendingFiles([])}}>Cancelar</button></div><label>Nome<input value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label><label>Categoria<select value={draft.category} onChange={e=>setDraft({...draft,category:e.target.value})}>{['Sofás','Mesas','Cadeiras','Sala de jantar','Área externa'].map(x=><option key={x}>{x}</option>)}</select></label><label>Preço numérico (opcional)<input type="number" step="0.01" value={draft.price??''} onChange={e=>setDraft({...draft,price:e.target.value})}/></label><label>Preço exibido<input value={draft.priceLabel} onChange={e=>setDraft({...draft,priceLabel:e.target.value})}/></label><label>Descrição<textarea value={draft.desc} onChange={e=>setDraft({...draft,desc:e.target.value})}/></label><label>Características (uma por linha)<textarea value={(draft.features||[]).join('\n')} onChange={e=>setDraft({...draft,features:e.target.value.split('\n').map(x=>x.trim()).filter(Boolean)})}/></label><label>Selo<input value={draft.tag||''} onChange={e=>setDraft({...draft,tag:e.target.value})}/></label><label>Ordem<input type="number" value={draft.sortOrder||0} onChange={e=>setDraft({...draft,sortOrder:Number(e.target.value)})}/></label><label className="toggle-line"><input type="checkbox" checked={draft.isActive!==false} onChange={e=>setDraft({...draft,isActive:e.target.checked})}/> Produto publicado</label><input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={files}/><button className="upload" onClick={()=>fileRef.current.click()}>Adicionar várias imagens</button>{draft.images?.length>0&&<div className="admin-thumbs">{draft.images.map((x,i)=><button key={i} onClick={()=>setDraft({...draft,image:x})}><img src={x}/><span>{draft.image===x?'Capa':'Definir capa'}</span></button>)}</div>}<button className="save-btn" onClick={save} disabled={!!busy}>{busy||'Salvar produto'}</button></div>}
 </aside></div>
}

class ErrorBoundary extends React.Component {
  constructor(props){super(props);this.state={error:null};}
  static getDerivedStateFromError(error){return {error};}
  componentDidCatch(error,info){console.error('Lux Decor render error:',error,info);}
  render(){
    if(this.state.error){
      return <div style={{minHeight:'100vh',display:'grid',placeItems:'center',padding:'32px',fontFamily:'system-ui',background:'#f6f4ef',color:'#0b1d33'}}>
        <div style={{maxWidth:620,border:'1px solid rgba(11,29,51,.18)',padding:32,background:'rgba(255,255,255,.82)'}}>
          <img src={A+'logo-lockup-navy.png'} alt="Lux Decor" style={{width:190,maxWidth:'60%',marginBottom:24}}/>
          <h1 style={{fontSize:28,margin:'0 0 12px'}}>O site encontrou um erro ao iniciar.</h1>
          <p style={{lineHeight:1.6,margin:0}}>Atualize a página. Se estiver rodando localmente, confirme que abriu pelo Vite com <b>npm run dev</b> e não diretamente pelo arquivo index.html.</p>
          <details style={{marginTop:18,opacity:.75}}><summary>Detalhes técnicos</summary><pre style={{whiteSpace:'pre-wrap',fontSize:12}}>{String(this.state.error?.message||this.state.error)}</pre></details>
        </div>
      </div>;
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(<ErrorBoundary><App/></ErrorBoundary>);
