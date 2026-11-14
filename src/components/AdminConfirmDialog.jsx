import React,{useEffect,useRef} from 'react';
import './AdminConfirmDialog.css';
export default function AdminConfirmDialog({title,message,busy=false,onCancel,onConfirm}){
 const cancelRef=useRef(null);
 useEffect(()=>{
  cancelRef.current?.focus();
  const onKey=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();if(!busy)onCancel()}};
  window.addEventListener('keydown',onKey,true);
  return()=>window.removeEventListener('keydown',onKey,true);
 },[busy,onCancel]);
 return <div className="lux-confirm-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)onCancel()}}>
  <section className="lux-confirm-card" role="alertdialog" aria-modal="true" aria-labelledby="lux-confirm-title" aria-describedby="lux-confirm-description">
   <span className="lux-confirm-kicker">Lux Decor · Confirmação</span>
   <h2 id="lux-confirm-title">{title}</h2>
   <p id="lux-confirm-description">{message}</p>
   <div className="lux-confirm-actions">
    <button type="button" className="lux-confirm-cancel" ref={cancelRef} disabled={busy} onClick={onCancel}>Cancelar</button>
    <button type="button" className="lux-confirm-danger" disabled={busy} onClick={onConfirm}>{busy?'Processando...':'Confirmar exclusão'}</button>
   </div>
  </section>
 </div>
}
