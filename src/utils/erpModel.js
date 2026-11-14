// Identidade conservadora do modelo: nunca confundir módulo, medida, cor ou acabamento com um novo produto.
// Compartilhada pela API e pelo painel para a mesma regra de associação.
const generic=new Set([
 'sofa','sofas','poltrona','poltronas','cadeira','cadeiras','mesa','mesas','de','da','do','das','dos',
 'para','com','em','e','a','o','linha','modelo','mod','modulo','modulos','medida','medidas','tamanho',
 'largura','altura','profundidade','m','cm','mm','metros','metro','lugares','lugar','assento','assentos',
 'retratil','reclinavel','fixo','fixa','canto','chaise','premium','luxo','lux','decor','estofado','estofados',
 'linho','veludo','couro','tecido','tecidos','suede','sarja','natural','ecologico','acabamento','cor','cores',
 'preto','preta','branco','branca','cinza','bege','marrom','azul','verde','off','white',
 'un','und','unidade','unidades','novo','nova','conjunto','jantar','centro','lateral','apoio',
 'produto','ref','sku','abc','ab','lm','ln','d'
]);
export function modelTokens(name){
 const cleaned=String(name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const words=cleaned.match(/[a-z]+|[0-9]+/g)||[];
 return words.filter(token=>token.length>=3&&!generic.has(token)&&!/^[0-9]+$/.test(token));
}
export function sameErpModel(siteName,erpName){
 const site=modelTokens(siteName),erp=modelTokens(erpName);
 // Sem modelo identificável não sugerimos vínculo por semelhança: é mais seguro revisar o nome.
 return site.length>0&&erp.length>0&&site[0]===erp[0];
}
