/** Preços comerciais: itens vinculados ao ERP não herdam preços manuais antigos. */
export function catalogDisplayPrice(product){
 if(product?.erpAvailability?.linked)return product.erpAvailability.sitePriceLabel||'Sob consulta';
 return product?.price!=null?(product.priceLabel||'Sob consulta'):'Solicitar orçamento';
}
