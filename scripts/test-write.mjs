// Pruebas de la lógica de api/write.js con un mock en memoria de supabase-js.
import { deductInventoryForOrder, syncCanalStock, disassemble, toVariant } from "../api/write.js";

function makeDb(store, log){
  function matches(row, filters){
    return filters.every(([c,v])=>{
      if(c[0]==="~"){ const col=c.slice(1); return String(row[col]||"").toUpperCase().startsWith(String(v).replace(/%$/,"").toUpperCase()); }
      if(c[0]==="@"){ const col=c.slice(1); return Array.isArray(v) && v.includes(row[col]); }
      return row[c]===v;
    });
  }
  function b(table){
    const f=[];
    const self={
      select(){ return self; },
      eq(c,v){ f.push([c,v]); return self; },
      in(c,v){ f.push(["@"+c,v]); return self; },
      ilike(c,v){ f.push(["~"+c,v]); return self; },
      limit(){ return self; },
      single(){ const r=(store[table]||[]).filter(x=>matches(x,f)); return Promise.resolve({data:r[0]?{...r[0]}:null,error:null}); },
      then(res){ const r=(store[table]||[]).filter(x=>matches(x,f)).map(x=>({...x})); res({data:r,error:null}); },
      update(patch){ return { eq(c,v){ (store[table]||[]).forEach(x=>{ if(x[c]===v){ Object.assign(x,patch); }}); log.push({table,update:patch}); return Promise.resolve({error:null}); } }; },
      insert(row){ log.push({table,insert:row}); (store[table]=store[table]||[]).push({id:(store.__seq=(store.__seq||1000)+1),...row}); const t={ select(){return{single(){return Promise.resolve({data:{id:store.__seq},error:null});}};}, then(res){res({error:null});} }; return t; },
    };
    return self;
  }
  return { from:(t)=>b(t) };
}
let fails=0;
const A=(c,m)=>{ if(!c){ console.error("✗ "+m); fails++; } else console.log("✓ "+m); };

(async()=>{
  // ---- deduct ----
  {
    const store={ order_items:[{id:1,order_id:99,product_id:10,quantity_pieces:3,quantity_kg:5200},{id:2,order_id:99,product_id:11,quantity_pieces:2,quantity_kg:null},{id:3,order_id:99,product_id:null}],
      products:[{id:10,stock_pieces:10,weighed_pieces:4,stock_kg:20.0},{id:11,stock_pieces:5,weighed_pieces:0,stock_kg:0}], inventory_transactions:[] };
    await deductInventoryForOrder(makeDb(store,[]),99);
    const p10=store.products[0];
    A(p10.stock_pieces===7 && p10.stock_kg==="14.800", "deduct: prod10 7pz / 14.800kg");
    A(store.inventory_transactions.filter(t=>t.transaction_type==="VENTA").length===2, "deduct: 2 VENTA (ignora item sin product_id)");
  }
  // ---- syncCanalStock ----
  {
    const store={ channel_purchases:[{user_uid:"system",qty_americano:4,qty_nacional:6},{user_uid:"system",qty_americano:2,qty_nacional:0},{user_uid:"otro",qty_americano:99,qty_nacional:99}],
      products:[{id:20,name:"CANAL AMERICANO",user_uid:"system",is_parent_product:true,avg_weight_per_piece_kg:105},{id:21,name:"CANAL NACIONAL LOMO",user_uid:"system",is_parent_product:true,avg_weight_per_piece_kg:52.5}],
      inventory_transactions:[{product_id:20,quantity_change_pieces:-2,transaction_type:"DESPIECE"}] };
    await syncCanalStock(makeDb(store,[]),"system");
    A(store.products[0].stock_pieces===4 && store.products[0].stock_kg==="420.000", "sync: AMERICANO 6-2=4 / 420kg");
    A(store.products[1].stock_pieces===6 && store.products[1].stock_kg==="315.000", "sync: NACIONAL 6 / 315kg");
  }
  // ---- disassemble (con dedup: el tipo específico gana sobre BASE) ----
  {
    const store={ products:[
        {id:100,name:"CANAL AMERICANO",stock_pieces:5,weighed_pieces:0,stock_kg:525},
        {id:200,stock_pieces:0,stock_kg:0},{id:201,stock_pieces:0,stock_kg:0},{id:202,stock_pieces:1,stock_kg:1}],
      product_transformations:[
        {id:1,parent_product_id:100,child_product_id:200,yield_quantity_pieces:2,yield_weight_ratio:0.3,transformation_type:"BASE",is_active:true},
        {id:2,parent_product_id:100,child_product_id:201,yield_quantity_pieces:1,yield_weight_ratio:0.2,transformation_type:"AMERICANO",is_active:true},
        {id:3,parent_product_id:100,child_product_id:202,yield_quantity_pieces:2,yield_weight_ratio:0.1,transformation_type:"BASE",is_active:true},
        {id:4,parent_product_id:100,child_product_id:202,yield_quantity_pieces:5,yield_weight_ratio:0.5,transformation_type:"AMERICANO",is_active:true}],
      inventory_transactions:[] };
    const r=await disassemble(makeDb(store,[]),{parentProductId:100,quantityToProcess:2,transformationType:"AMERICANO"});
    const P=(id)=>store.products.find(x=>x.id===id);
    A(P(100).stock_pieces===3 && P(100).stock_kg==="315.000", "despiece: canal 5-2=3 / 525-210=315kg");
    A(P(200).stock_pieces===4 && P(200).stock_kg==="63.000", "despiece: hijo200 4pz / 63kg (BASE)");
    A(P(201).stock_pieces===2 && P(201).stock_kg==="42.000", "despiece: hijo201 2pz / 42kg (AMERICANO)");
    A(P(202).stock_pieces===11 && P(202).stock_kg==="106.000", "despiece: hijo202 dedup→AMERICANO gana (1+10pz / 1+105kg)");
    A(r.childrenCreated===3, "despiece: 3 hijos (202 una sola vez)");
    A(store.inventory_transactions.filter(t=>t.transaction_type==="DESPIECE").length===4, "despiece: 4 transacciones DESPIECE (1 padre + 3 hijos)");
  }
  // ---- disassemble sin recetas: NO debe escribir (valida antes) ----
  {
    const store={ products:[{id:300,name:"CANAL X",stock_pieces:3,weighed_pieces:0,stock_kg:300}], product_transformations:[], inventory_transactions:[] };
    const r=await disassemble(makeDb(store,[]),{parentProductId:300,quantityToProcess:1,transformationType:"BASE"});
    A(!!r.error && store.products[0].stock_pieces===3 && store.inventory_transactions.length===0, "despiece: sin recetas → error y SIN descontar");
  }
  // ---- toVariant ----
  {
    const store={ products:[{id:400,stock_pieces:10,stock_kg:90,avg_weight_per_piece_kg:9},{id:401,stock_pieces:0,stock_kg:0}],
      product_transformations:[{id:9,parent_product_id:400,child_product_id:401,yield_weight_ratio:0.9,is_variant:true}], inventory_transactions:[] };
    await toVariant(makeDb(store,[]),{baseProductId:400,variantProductId:401,pieces:3});
    A(store.products[0].stock_pieces===7 && store.products[0].stock_kg==="63.000", "variante: base 10-3=7 / 90-27=63kg");
    A(store.products[1].stock_pieces===3 && store.products[1].stock_kg==="24.300", "variante: variante 3pz / 27*0.9=24.3kg");
  }
  console.log(fails?`\n❌ ${fails} FALLO(S)`:"\n✅ TODOS LOS TESTS PASARON");
  process.exitCode = fails?1:0;
})();
