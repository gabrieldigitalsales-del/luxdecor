import assert from 'node:assert/strict';
import fs from 'node:fs';
import {sameErpModel} from '../src/utils/erpModel.js';
import {catalogDisplayPrice} from '../src/utils/catalogPrice.js';
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
console.log('OK: integração, publicação controlada, preço protegido e confirmações personalizadas.');
