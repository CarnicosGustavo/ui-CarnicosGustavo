import { deductInventoryForOrder, syncCanalStock } from "../api/write.js";

// ---- mock mínimo de supabase-js ----
function makeDb(store, log){
  function matches(row, filters){
    return filters.every(([c,v])=>{
      if(c.startsWith("~")){ const col=c.slice(1); return String(row[col]||"").toUpperCase().startsWith(String(v).replace(/%$/,"").toUpperCase()); }
      return row[c]===v;
    });
  }
  function builder(table){
    const filters=[];
    const sel={ };
    const self={
      select(){ return self; },
      eq(c,v){ filters.push([c,v]); return self; },
      ilike(c,v){ filters.push(["~"+c,v]); return self; },
      single(){ const r=(store[table]||[]).filter(x=>matches(x,filters)); return Promise.resolve({data:r[0]?{...r[0]}:null,error:null}); },
      then(res){ const r=(store[table]||[]).filter(x=>matches(x,filters)).map(x=>({...x})); res({data:r,error:null}); },
      update(patch){ return { eq(c,v){ (store[table]||[]).forEach(x=>{ if(x[c]===v){ Object.assign(x,patch); log.push({table,update:patch,where:[c,v]});}}); return Promise.resolve({error:null}); } }; },
      insert(row){ log.push({table,insert:row}); (store[table]=store[table]||[]).push({id:(store.__seq=(store.__seq||1000)+1),...row}); const t={ select(){return{single(){return Promise.resolve({data:{id:store.__seq},error:null});}};}, then(res){res({error:null});} }; return t; },
    };
    return self;
  }
  return { from:(t)=>builder(t) };
}
function assert(c,m){ if(!c){ console.error("✗ "+m); process.exitCode=1; } else console.log("✓ "+m); }

// ===== TEST 1: descuento de inventario =====
(async()=>{
  const store={
    order_items:[
      { id:1, order_id:99, product_id:10, quantity_pieces:3, quantity_kg:5200 }, // 5.2 kg
      { id:2, order_id:99, product_id:11, quantity_pieces:2, quantity_kg:null },  // por pieza
      { id:3, order_id:99, product_id:null, quantity_pieces:1, quantity_kg:1000 },// sin producto → se ignora
    ],
    products:[
      { id:10, stock_pieces:10, weighed_pieces:4, stock_kg:20.0 },
      { id:11, stock_pieces:5,  weighed_pieces:0, stock_kg:0 },
    ],
    inventory_transactions:[],
  };
  const log=[];
  await deductInventoryForOrder(makeDb(store,log), 99);
  const p10=store.products.find(x=>x.id===10), p11=store.products.find(x=>x.id===11);
  assert(p10.stock_pieces===7, `prod10 piezas 10-3=7 (got ${p10.stock_pieces})`);
  assert(p10.stock_kg==="14.800", `prod10 kg 20-5.2=14.800 (got ${p10.stock_kg})`);
  assert(p10.weighed_pieces===4, `prod10 weighed clamp ≤ next (got ${p10.weighed_pieces})`);
  assert(p11.stock_pieces===3, `prod11 piezas 5-2=3 (got ${p11.stock_pieces})`);
  const vtas=store.inventory_transactions.filter(t=>t.transaction_type==="VENTA");
  assert(vtas.length===2, `2 transacciones VENTA (ignora item sin product_id) (got ${vtas.length})`);
  assert(vtas[0].quantity_change_pieces===-3 && vtas[0].quantity_change_kg==="-5.200", "VENTA prod10 signos correctos");

  // ===== TEST 2: syncCanalStock =====
  const store2={
    channel_purchases:[
      { user_uid:"system", qty_americano:4, qty_nacional:6 },
      { user_uid:"system", qty_americano:2, qty_nacional:0 },
      { user_uid:"otro",   qty_americano:99, qty_nacional:99 }, // no cuenta
    ],
    products:[
      { id:20, name:"CANAL AMERICANO", user_uid:"system", is_parent_product:true, avg_weight_per_piece_kg:105 },
      { id:21, name:"CANAL NACIONAL LOMO", user_uid:"system", is_parent_product:true, avg_weight_per_piece_kg:52.5 },
      { id:22, name:"PIERNA", user_uid:"system", is_parent_product:false, avg_weight_per_piece_kg:9 },
    ],
    inventory_transactions:[
      { product_id:20, quantity_change_pieces:-2, transaction_type:"DESPIECE" }, // 2 americanos despiezados
    ],
  };
  const log2=[];
  await syncCanalStock(makeDb(store2,log2), "system");
  const c20=store2.products.find(x=>x.id===20), c21=store2.products.find(x=>x.id===21);
  assert(c20.stock_pieces===4, `CANAL AMERICANO: comprado 6 - despiezado 2 = 4 (got ${c20.stock_pieces})`);
  assert(c20.stock_kg==="420.000", `CANAL AMERICANO kg 4*105=420.000 (got ${c20.stock_kg})`);
  assert(c21.stock_pieces===6, `CANAL NACIONAL: 6 nacionales, 0 despiece = 6 (got ${c21.stock_pieces})`);
  assert(c21.stock_kg==="315.000", `CANAL NACIONAL kg 6*52.5=315.000 (got ${c21.stock_kg})`);
  console.log(process.exitCode?"\n❌ FALLOS":"\n✅ TODOS LOS TESTS PASARON");
})();
