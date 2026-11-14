/** Preserve draft status until new images have been uploaded and registered.
 * Editing "Produto publicado" changes the form value before the product is saved,
 * so the original hidden status must be retained separately.
 */
export function shouldStageProductAsHidden(product,newFiles=[]){
 const wantsPublish=product?.isActive!==false;
 const hasPendingUploads=Array.isArray(newFiles)&&newFiles.length>0;
 return wantsPublish&&hasPendingUploads&&(!product?.id||product?.wasHidden===true);
}
