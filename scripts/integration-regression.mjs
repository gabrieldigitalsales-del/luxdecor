import assert from 'node:assert/strict';
import fs from 'node:fs';
import {sameErpModel} from '../src/utils/erpModel.js';
import {catalogDisplayPrice} from '../src/utils/catalogPrice.js';
import {shouldStageProductAsHidden} from '../src/utils/productPublication.js';
import {summarizeLinkedProducts} from '../api/_erp.js';

const fixtures=[
 {id:'nev-80',nome_produto:'Sofá Nevada',fornecedor:'LUART',variante:'80',cor_acabamento:'AB202',stock:2,preco_final:3300,publishOnSite:false},
 {id:'nev-100',nome_produto:'Sofá Nevada',fornecedor:'LUART',variante:'100',cor_acabamento:'AB201',stock:1,preco_final:3500,publishOnSite:false},
 {id:'nev-120',nome_produto:'Sofá Nevada',fornecedor:'LUART',variante:'120',cor_acabamento:'LM537',stock:0,preco_final:3900,publishOnSite:false},
];
const links=[
 ...fixtures.map(x=>({site_product_id:'site-nevada-1',erp_product_id:x.id})),
 ...fixtures.map(x=>({site_product_id:'site-nevada-2',erp_product_id:x.id})),
];
assert.deepEqual(summarizeLinkedProducts(fixtures,links),{},'Item vinculado mas não autorizado não pode aparecer no endpoint público');
const released=fixtures.map(x=>({...x,publishOnSite:true}));
const result=summarizeLinkedProducts(released,links);
assert.equal(result['site-nevada-1'].variants,3);
assert.equal(result['site-nevada-2'].variants,3);
assert.equal(result['site-nevada-1'].quantity,3);
assert.equal(new Set(result['site-nevada-1'].options.map(x=>x.id)).size,3);
assert.ok(sameErpModel('Sofá Nevada','Sofá Nevada'));
assert.ok(!sameErpModel('Sofá Creta','Sofá Nevada'));
assert.equal(fixtures.every(x=>x.publishOnSite===false),true,'A liberação não pode mudar dados de origem nos testes');
const admin=fs.readFileSync(new URL('../api/admin.js',import.meta.url),'utf8');
assert.ok(!admin.includes("erpItem.publishOnSite!==true)return json(res,400"),'Associação deve ser possível antes de liberação');
assert.ok(admin.includes("modelNames.length!==1||factories.length!==1"),'Liberação deve validar modelo e fabricante');
assert.equal(catalogDisplayPrice({price:2999,priceLabel:'R$ 2.999',erpAvailability:{linked:true,options:[]}}),'Sob consulta','Não vazar preço manual quando preço ERP ainda não foi autorizado');
assert.equal(catalogDisplayPrice({price:2999,priceLabel:'R$ 2.999',erpAvailability:{linked:true,sitePriceLabel:'R$ 3.500'}}),'R$ 3.500');
assert.equal(catalogDisplayPrice({price:2999,priceLabel:'R$ 2.999'}),'R$ 2.999');
const main=fs.readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
assert.ok(!/\bconfirm\s*\(/.test(main),'Ações do Admin não devem usar confirmação nativa do navegador');
assert.ok(main.includes('<AdminConfirmDialog'), 'Exclusões precisam de modal personalizado');
const erpUi=fs.readFileSync(new URL('../src/components/ErpIntegration.jsx',import.meta.url),'utf8');
assert.ok(erpUi.includes("modelTokens(item.modelName||item.name).join('-')"),'Fila deve agrupar modelo completo, não somente prefixo');
// Caso reportado: rascunho com vínculo no ERP, foto recém-anexada
// e checkbox "Produto publicado" marcado no formulário.
const pendingPhoto=[{name:'camaro.webp',type:'image/webp'}];
assert.equal(shouldStageProductAsHidden({id:'camaro-id',isActive:true,wasHidden:true},pendingPhoto),true,'Rascunho oculto deve gravar a foto antes de publicar');
assert.equal(shouldStageProductAsHidden({id:'camaro-id',isActive:false,wasHidden:true},pendingPhoto),false,'Salvar como rascunho não pode publicar');
assert.equal(shouldStageProductAsHidden({id:'public-id',isActive:true,wasHidden:false},pendingPhoto),false,'Produto já publicado permanece publicado durante upload');
assert.equal(shouldStageProductAsHidden({isActive:true},pendingPhoto),true,'Produto novo deve aguardar foto');
assert.equal(shouldStageProductAsHidden({id:'camaro-id',isActive:true,wasHidden:true},[]),false,'Sem upload pendente não deve atrasar gravação');
const catalogService=fs.readFileSync(new URL('../src/services/catalog.js',import.meta.url),'utf8');
const saveFlow=catalogService.slice(catalogService.indexOf('export async function saveProduct('),catalogService.indexOf('export async function setProductCover'));
assert.ok(saveFlow.indexOf("adminApi('addProductImage'")<saveFlow.indexOf("adminApi('saveProduct',{product:{...staged,id,isActive:true}})"),'Publicação acontece após cadastro da foto');
assert.ok(saveFlow.indexOf("adminApi('setCover'")<saveFlow.indexOf("adminApi('saveProduct',{product:{...staged,id,isActive:true}})"),'Publicação acontece após definir a capa');
assert.ok(main.includes('wasHidden:p.isActive===false'),'O editor deve preservar o status original do produto');
console.log('OK: publicação de ocultos com foto, vínculo ERP e sem perda de dados.');
const settingsCode=fs.readFileSync(new URL('../src/services/catalog.js',import.meta.url),'utf8');
const appCode=fs.readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
const backend=fs.readFileSync(new URL('../api/admin.js',import.meta.url),'utf8');
assert.ok(settingsCode.includes('erpLiveCatalogEnabled: settings?.erp_live_catalog_enabled !== false'),'A flag precisa ser lida do Supabase');
assert.ok(settingsCode.includes('includeErp?fetchErpAvailability()'),'O catálogo deve omitir consulta ao ERP quando desativado');
assert.ok(backend.includes('erp_live_catalog_enabled:s.erpLiveCatalogEnabled!==false'),'A opção deve ser salva no Supabase');
assert.ok(appCode.includes("fetchCatalog({includeErp:false})"),'Primeiro carregamento não deve esperar ERP');
assert.ok(appCode.includes('if(settings.erpLiveCatalogEnabled===false)'),'Desativar deve cancelar consultas automáticas');
assert.ok(appCode.includes('clearInterval(t)'),'Intervalo ERP deve ser limpo ao desativar');
assert.ok(appCode.includes('Consultar estoque e variações do ERP automaticamente'),'Admin precisa expor botão de controle');
console.log('OK: controle de sincronização ERP persistido e carregamento rápido do catálogo.');

