/* ============================================================
   Pantallas operativas (C) — Pedidos · Clientes · Cobranza ·
   Rendimiento · POS — nuevo diseño, fiel a la Guía UI/UX
   ============================================================ */
const Cx = window.CG.color;
const Fx = window.CG.font;
const OPS = window.CG.ops;
const mny  = window.money;
const mnyk = window.moneyk;
const SlotC = window.Slot;

// Imprime un ticket REAL del pedido (datos de /api/ticket); si no hay datos, cae a window.print().
function printTicket(orderId){
  if(!orderId){ window.print(); return; }
  fetch("/api/ticket?orderId="+orderId)
    .then(function(r){ return r.ok?r.json():null; })
    .then(function(t){
      if(!t || t._source==="mock" || !Array.isArray(t.items)){ window.print(); return; }
      var esc = function(s){ return String(s==null?"":s).replace(/[&<>]/g, function(c){ return ({"&":"&amp;","<":"&lt;",">":"&gt;"})[c]; }); };
      var rows = t.items.map(function(it){
        var qty = it.quantityKg>0 ? it.quantityKg.toFixed(3)+" kg" : it.quantityPieces+" pz";
        return "<tr><td>"+esc(it.productName)+"</td><td class=r>"+qty+"</td><td class=r>$"+it.subtotal.toFixed(2)+"</td></tr>";
      }).join("");
      var fecha = t.date ? new Date(t.date).toLocaleString("es-MX") : "";
      var html = "<!doctype html><meta charset=utf-8><title>Ticket "+t.ticketNumber+"</title>"
        + "<style>*{font-family:ui-monospace,monospace}body{width:300px;margin:0 auto;padding:14px;color:#111}"
        + "h1{font-size:15px;text-align:center;margin:0 0 2px}.sub{text-align:center;font-size:11px;color:#555;margin-bottom:10px}"
        + "table{width:100%;border-collapse:collapse;font-size:11px}td{padding:3px 0;border-bottom:1px dashed #ccc}.r{text-align:right}"
        + ".tot{font-size:13px;font-weight:700;margin-top:8px;display:flex;justify-content:space-between}"
        + ".badge{display:inline-block;margin-top:8px;font-size:11px;padding:2px 8px;border:1px solid #111;border-radius:4px}</style>"
        + "<h1>CÁRNICOS GUSTAVO</h1><div class=sub>Ticket "+t.ticketNumber+" · "+esc(fecha)+"<br>"
        + (t.customerName?("Cliente: "+esc(t.customerName)):"Mostrador")+"</div>"
        + "<table><thead><tr><td><b>Producto</b></td><td class=r><b>Cant</b></td><td class=r><b>Importe</b></td></tr></thead><tbody>"
        + rows + "</tbody></table>"
        + "<div class=tot><span>TOTAL</span><span>$"+t.totalAmount.toFixed(2)+"</span></div>"
        + "<div class=sub style='margin-top:6px'>"+t.totalKg.toFixed(3)+" kg</div>"
        + "<div style='text-align:center'><span class=badge>"+esc(t.paymentStatus)+"</span></div>";
      var w = window.open("", "_blank", "width=360,height=640");
      if(!w){ window.print(); return; }
      w.document.write(html); w.document.close(); w.focus(); setTimeout(function(){ w.print(); }, 200);
    })
    .catch(function(){ window.print(); });
}

/* Estado de pedido → tono (mapa de la guía) */
const ESTADO_TONE = {
  "Pagada":"green", "Lista para cobro":"blue", "Procesando pago":"blue",
  "Por pesar":"amber", "Parcial":"amber", "Cancelada":"red",
  "Pendiente":"amber", "Producción":"blue",
};

/* Barra de búsqueda + filtros reutilizable */
function SearchFilter({ placeholder, filters, value, onFilter, right }) {
  return (
    <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center", marginBottom:14 }}>
      <div style={{ display:"flex", alignItems:"center", gap:9, border:`1px solid ${Cx.line}`, borderRadius:11,
        padding:"11px 14px", background:Cx.paper, flex:"1 1 240px", minWidth:0 }}>
        <Icon name="search" size={16} color={Cx.inkFaint} />
        <input placeholder={placeholder} style={{ flex:1, border:"none", background:"transparent", outline:"none",
          font:`500 14px/1 ${Fx.ui}`, color:Cx.ink, minWidth:0 }} />
      </div>
      {filters && (
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {filters.map(f=>{
            const on=value===f;
            return <button key={f} onClick={()=>onFilter&&onFilter(f)} style={{ font:`700 12.5px/1 ${Fx.ui}`,
              padding:"10px 13px", borderRadius:9, cursor:"pointer", border:`1px solid ${on?"transparent":Cx.line}`,
              color:on?Cx.chromeFg:Cx.inkSoft, background:on?Cx.chrome:Cx.paper }}>{f}</button>;
          })}
        </div>
      )}
      {right && <div style={{ marginLeft:"auto" }}>{right}</div>}
    </div>
  );
}

/* Botón de ícono para acciones de fila */
function RowAct({ icon, color, title, onClick }) {
  return <button title={title} onClick={onClick} style={{ width:34, height:34, borderRadius:8, border:`1px solid ${Cx.line}`,
    background:Cx.paper, cursor:"pointer", display:"grid", placeItems:"center" }}>
    <Icon name={icon} size={15} color={color||Cx.inkSoft} /></button>;
}
/* Abre WhatsApp con el teléfono (si hay) y un texto opcional */
function waOpen(tel, text){
  const num = (tel||"").replace(/\D/g,"");
  window.open("https://wa.me/" + num + (text ? "?text="+encodeURIComponent(text) : ""), "_blank");
}
/* Descarga un CSV a partir de filas (array de arrays) */
function downloadCSV(name, rows){
  const csv = rows.map(r=>r.map(c=>'"'+String(c==null?"":c).replace(/"/g,'""')+'"').join(",")).join("\n");
  const a = document.createElement("a");
  a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
  a.download = name; a.click();
}
/* Abre el selector de archivos del sistema (importación) */
function pickFile(accept){
  const i = document.createElement("input"); i.type = "file"; if (accept) i.accept = accept; i.click();
}
const thBase = (align)=>({ textAlign:align, font:`700 11px/1 ${Fx.ui}`, letterSpacing:"0.05em",
  textTransform:"uppercase", color:Cx.inkFaint, padding:"12px 14px" });

/* ---------------- PEDIDOS ---------------- */
function PedidosScreen({ ai }) {
  const [filtro, setFiltro] = useState("Todos");
  const [nuevoPedido, setNuevoPedido] = useState(false);
  const [editPedido, setEditPedido] = useState(null); // {id, cliente, customerId, items} o null
  const abrirEditar = (p)=>{
    fetch("/api/order?id="+p.id).then(function(r){ return r.ok?r.json():null; })
      .then(function(d){ if(d && Array.isArray(d.items) && d.items.length) setEditPedido({ id:p.id, cliente:d.cliente, customerId:d.customerId, items:d.items }); else setNuevoPedido(true); })
      .catch(function(){ setNuevoPedido(true); });
  };
  const [pesaje, setPesaje] = useState(null);     // {n, pedido, precio} o null
  const [extra, setExtra] = useState([]);          // pedidos creados en sesión
  const [orden, setOrden] = useState(null);        // "total" | "fecha" | null
  const [over, setOver] = useState({});            // id -> {estado} (cancelar)
  const [hidden, setHidden] = useState([]);        // ids eliminados
  let data = [...extra, ...OPS.pedidos]
    .filter(p=> !hidden.includes(p.id))
    .map(p=> over[p.id] ? { ...p, ...over[p.id] } : p)
    .filter(p=> filtro==="Todos" || p.estado===filtro);
  if (orden==="total") data = [...data].sort((a,b)=> b.total-a.total);
  if (orden==="fecha") data = [...data].sort((a,b)=> String(b.fecha).localeCompare(String(a.fecha)));
  const exportCSV = ()=> downloadCSV("pedidos.csv",
    [["Pedido","Cliente","Total","Estado","Fecha"], ...data.map(p=>["#"+p.id, p.cliente, p.total, p.estado, p.fecha])]);

  const rowMenu = (p) => [
    { label:"Ver detalle", icon:"eye", onClick:()=>printTicket(p.id) },
    { label:"Editar pedido", icon:"file-pen", onClick:()=>abrirEditar(p) },
    ...(p.estado==="Por pesar" || p.estado==="Parcial"
      ? [{ label:"Ir a Pesaje", icon:"scale", onClick:()=>setPesaje({ n:"PIERNA", pedido:`#${p.id}`, precio:70 }) }] : []),
    ...(p.estado==="Lista para cobro"
      ? [{ label:"Ir a Pesaje", icon:"scale", onClick:()=>setPesaje({ n:"PIERNA", pedido:`#${p.id}`, precio:70 }) }] : []),
    { sep:true },
    { label:"Imprimir ticket", icon:"printer", onClick:()=>printTicket(p.id) },
    { label:"Duplicar", icon:"copy", onClick:()=>setExtra(arr=>[{ ...p, id:360+arr.length }, ...arr]) },
    { label:"Enviar por WhatsApp", icon:"message-circle", onClick:()=>waOpen("", `Pedido #${p.id} de ${p.cliente}`) },
    { sep:true },
    ...(p.estado!=="Cancelada" ? [{ label:"Cancelar pedido", icon:"ban", onClick:()=>{ setOver(o=>({ ...o, [p.id]:{ estado:"Cancelada" } }));
      if(window.CG.write) window.CG.write("order.update",{ id:p.id, status:"cancelled" }).then(function(r){ if(r&&r.ok&&window.CG.refresh) window.CG.refresh(); }); } }] : []),
    { label:"Eliminar", icon:"trash-2", danger:true, onClick:()=>{ if(!window.confirm(`¿Eliminar el pedido #${p.id}?`)) return; setHidden(h=>[...h, p.id]);
      if(window.CG.write) window.CG.write("order.delete",{ id:p.id }).then(function(r){ if(r&&r.ok&&window.CG.refresh) window.CG.refresh(); }); } },
  ];

  return (
    <div>
      <ScreenHead title="Pedidos" desc="Listado central de pedidos del día. Crea, edita, pesa, imprime tickets y entra al detalle."
        right={
          <SplitButton kind="primary" icon="plus" onClick={()=>setNuevoPedido(true)}
            items={[
              { label:"Pedido mostrador", icon:"store", onClick:()=>setNuevoPedido(true) },
              { label:"Pedido a crédito", icon:"hand-coins", onClick:()=>setNuevoPedido(true) },
              { sep:true },
              { label:"Pesar producto", icon:"scale", onClick:()=>setPesaje({ n:"PIERNA", pedido:"libre", precio:70 }) },
              { label:"Importar pedidos (CSV)", icon:"upload", onClick:()=>pickFile(".csv") },
            ]}>
            Nuevo pedido
          </SplitButton>
        } />
      <SlotC id="pedidos" ai={ai} />
      <Card pad={0} style={{ overflow:"hidden" }}>
        <div style={{ padding:16, borderBottom:`1px solid ${Cx.line}` }}>
          <SearchFilter placeholder="Buscar pedido o cliente…" value={filtro} onFilter={setFiltro}
            filters={["Todos","Pagada","Por pesar","Lista para cobro","Cancelada"]}
            right={
              <Menu align="right" items={[
                { label:"Exportar CSV", icon:"download", onClick:exportCSV },
                { label:"Imprimir lista", icon:"printer", onClick:()=>window.print() },
                { label:"Ordenar por total", icon:"arrow-down-wide-narrow", onClick:()=>setOrden("total") },
                { label:"Ordenar por fecha", icon:"calendar", onClick:()=>setOrden("fecha") },
              ]} trigger={<Btn kind="outline" size="sm" icon="sliders-horizontal">Vista</Btn>} />
            } />
        </div>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", minWidth:680 }}>
            <thead><tr style={{ background:Cx.paper2 }}>
              <th style={thBase("left")}>Pedido</th><th style={thBase("left")}>Cliente</th>
              <th style={thBase("right")}>Total</th><th style={thBase("left")}>Estado</th>
              <th style={thBase("left")}>Fecha</th><th style={thBase("center")}>Acciones</th>
            </tr></thead>
            <tbody>
              {data.map(p=>(
                <tr key={p.id} style={{ borderTop:`1px solid ${Cx.lineSoft}` }}>
                  <td style={{ padding:"13px 14px", font:`700 13.5px/1 ${Fx.mono}`, color:Cx.ink }}>#{p.id}</td>
                  <td style={{ padding:"13px 14px", font:`700 13.5px/1 ${Fx.ui}`, color:Cx.ink }}>{p.cliente}
                    <span style={{ font:`500 11.5px/1 ${Fx.ui}`, color:Cx.inkFaint, marginLeft:8 }}>{p.items} art.</span></td>
                  <td style={{ padding:"13px 14px", textAlign:"right", font:`700 13.5px/1 ${Fx.mono}`,
                    color: p.total>0?Cx.ink:Cx.inkFaint }}>{p.total>0?mny(p.total):"—"}</td>
                  <td style={{ padding:"13px 14px" }}><Badge tone={ESTADO_TONE[p.estado]}>{p.estado}</Badge></td>
                  <td style={{ padding:"13px 14px", font:`500 13px/1 ${Fx.mono}`, color:Cx.inkSoft }}>{p.fecha}</td>
                  <td style={{ padding:"13px 14px" }}>
                    <div style={{ display:"flex", gap:7, justifyContent:"center", alignItems:"center" }}>
                      <RowAct icon="eye" title="Ver detalle" onClick={()=>printTicket(p.id)} />
                      {(p.estado==="Por pesar"||p.estado==="Parcial") &&
                        <button title="Pesar" onClick={()=>setPesaje({ n:"PIERNA", pedido:`#${p.id}`, precio:70 })}
                          style={{ width:34, height:34, borderRadius:8, border:`1px solid ${Cx.amber}`, background:Cx.amberWash,
                            cursor:"pointer", display:"grid", placeItems:"center" }}>
                          <Icon name="scale" size={15} color={Cx.amber} /></button>}
                      <Kebab items={rowMenu(p)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <NuevoPedidoModal open={nuevoPedido || !!editPedido} onClose={()=>{ setNuevoPedido(false); setEditPedido(null); }}
        initial={editPedido}
        onSave={(o)=>{
          if(!editPedido) return;
          const cust = (window.CG.ops.clientes||[]).find(c=>c.nombre===o.cliente);
          const cat = (window.CG.ops.pos && window.CG.ops.pos.catalogo) || [];
          const items = o.items.map(function(it){ const pr = it.productId ? null : cat.find(c=>c.n===it.n);
            return { productId: it.productId || (pr?pr.id:null), productName:it.n, pieces:it.pz, kg: it.kg||0, price:it.precio, byWeight: it.disp==="pesaje" }; });
          if(window.CG.write) window.CG.write("order.replaceItems", { orderId:editPedido.id, items, customerId: cust?cust.id:editPedido.customerId })
            .then(function(r){ if(r&&r.ok&&window.CG.refresh) window.CG.refresh(); });
        }}
        onCreate={(o)=>{ const id = 360 + extra.length;
          setExtra(arr => [{ id, cliente:o.cliente, total:o.total, items:o.items.length,
            estado: o.items.some(x=>x.disp==="pesaje"||x.disp==="despiece")?"Por pesar":"Lista para cobro", fecha:"12/06" }, ...arr]);
          const cust = (window.CG.ops.clientes||[]).find(c=>c.nombre===o.cliente);
          if (cust && window.CG.write) {
            const cat = (window.CG.ops.pos && window.CG.ops.pos.catalogo) || [];
            const items = o.items.map(it=>{ const pr = cat.find(c=>c.n===it.n);
              return { productId: pr?pr.id:null, productName:it.n, pieces:it.pz, kg:0, price:it.precio, byWeight: it.disp==="pesaje" }; });
            window.CG.write("order.create", { customerId:cust.id, items })
              .then(function(r){ if(r&&r.ok&&window.CG.refresh) window.CG.refresh(); });
          }
        }} />
      <PesajeModal open={!!pesaje} producto={pesaje} onClose={()=>setPesaje(null)}
        onRegister={()=>{}} />
    </div>
  );
}

/* ---------------- CLIENTES ---------------- */
function ClientesScreen({ ai }) {
  const [filtro, setFiltro] = useState("Todos");
  const [nuevo, setNuevo] = useState(false);
  const [editC, setEditC] = useState(null);   // cliente a editar o null
  const [extra, setExtra] = useState([]);
  const goTo = (m)=> window.__cgGo && window.__cgGo(m);
  const all = [...extra, ...OPS.clientes];
  const data = all.filter(c=> filtro==="Todos" || c.estado===filtro);
  return (
    <div>
      <ScreenHead title="Clientes" desc="Lista maestra de carnicerías y negocios. Busca, da de alta y entra a la ficha 360°."
        right={<Btn kind="primary" icon="user-plus" onClick={()=>setNuevo(true)}>Agregar cliente</Btn>} />
      <SlotC id="clientes" ai={ai} />
      <Card pad={0} style={{ overflow:"hidden" }}>
        <div style={{ padding:16, borderBottom:`1px solid ${Cx.line}` }}>
          <SearchFilter placeholder="Buscar cliente…" value={filtro} onFilter={setFiltro}
            filters={["Todos","Activo","Inactivo"]} right={<Btn kind="outline" size="sm" icon="download"
              onClick={()=>downloadCSV("clientes.csv", [["Negocio","Teléfono","Saldo","Estado"],
                ...data.map(c=>[c.nombre, c.tel||"", c.saldo, c.estado])])}>CSV</Btn>} />
        </div>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", minWidth:640 }}>
            <thead><tr style={{ background:Cx.paper2 }}>
              <th style={thBase("left")}>Negocio</th><th style={thBase("left")}>Teléfono</th>
              <th style={thBase("right")}>Saldo</th><th style={thBase("left")}>Estado</th>
              <th style={thBase("center")}>Acciones</th>
            </tr></thead>
            <tbody>
              {data.map(c=>(
                <tr key={c.id} style={{ borderTop:`1px solid ${Cx.lineSoft}` }}>
                  <td style={{ padding:"13px 14px" }}>
                    <div style={{ font:`700 13.5px/1.1 ${Fx.ui}`, color:Cx.ink }}>{c.nombre}</div>
                    <div style={{ font:`500 11px/1 ${Fx.ui}`, color:Cx.inkFaint, marginTop:4 }}>{c.pedidos} pedidos · {mnyk(c.gastado)}</div>
                  </td>
                  <td style={{ padding:"13px 14px", font:`500 13px/1 ${Fx.mono}`, color: c.tel?Cx.ink80:Cx.inkFaint }}>{c.tel||"—"}</td>
                  <td style={{ padding:"13px 14px", textAlign:"right", font:`700 13px/1 ${Fx.mono}`,
                    color: c.saldo>0?Cx.red:Cx.inkFaint }}>{c.saldo>0?mny(c.saldo):"$0.00"}</td>
                  <td style={{ padding:"13px 14px" }}><Badge tone={c.estado==="Activo"?"green":"ghost"}>{c.estado}</Badge></td>
                  <td style={{ padding:"13px 14px" }}>
                    <div style={{ display:"flex", gap:7, justifyContent:"center", alignItems:"center" }}>
                      {c.tel && <RowAct icon="message-circle" color={Cx.green} title="WhatsApp"
                        onClick={()=>waOpen(c.tel, `Hola ${c.nombre}`)} />}
                      <Kebab items={[
                        { label:"Nuevo pedido", icon:"plus", onClick:()=>{ window.__cgPosClient = { id:c.id, nombre:c.nombre }; goTo("pos"); } },
                        { label:"Editar cliente", icon:"file-pen", onClick:()=>setEditC(c) },
                        ...(c.tel ? [{ label:"WhatsApp", icon:"message-circle", onClick:()=>waOpen(c.tel, `Hola ${c.nombre}`) }] : []),
                        { label:"Estado de cuenta", icon:"file-text", onClick:()=>goTo("cobranza") },
                        { sep:true },
                        { label:"Eliminar", icon:"trash-2", danger:true,
                          onClick:()=>{ if(!window.confirm(`¿Eliminar a ${c.nombre}?`)) return;
                            setExtra(arr=>arr.filter(x=>x.id!==c.id));
                            if (window.CG.write) window.CG.write("customer.delete", { id:c.id })
                              .then(function(r){ if(r&&r.ok&&window.CG.refresh) window.CG.refresh(); }); } },
                      ]} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <NuevoClienteModal open={nuevo} onClose={()=>setNuevo(false)}
        onCreate={(f)=>{ const id = 100 + extra.length;
          setExtra(arr => [{ id, nombre:f.nombre, tel:f.tel, saldo:0, estado:"Activo", pedidos:0, gastado:0 }, ...arr]);
          if (window.CG.write) window.CG.write("customer.create", {
            name:f.nombre, contact_name:f.contacto||null, phone:f.tel||null, whatsapp_phone:f.tel||null,
            address:f.dir||null, notes:f.notas||null,
            credit_limit:(f.tipo==="credito" && f.limite) ? Number(f.limite) : undefined,
          }).then(function(r){ if(r&&r.ok&&window.CG.refresh) window.CG.refresh(); });
        }} />
      <EditarClienteModal open={!!editC} cliente={editC} onClose={()=>setEditC(null)}
        onSave={(u)=>{
          if (editC && editC.id && window.CG.write) window.CG.write("customer.update", {
            id:editC.id, name:u.nombre, phone:u.tel, address:u.dir,
          }).then(function(r){ if(r&&r.ok&&window.CG.refresh) window.CG.refresh(); });
          setEditC(null);
        }} />
    </div>
  );
}

/* ---------------- COBRANZA ---------------- */
function CobranzaScreen({ ai }) {
  const [abono, setAbono] = useState(null);   // cliente {nombre,saldo} o null
  const [estado, setEstado] = useState(null); // estado de cuenta de un cliente
  const [cargo, setCargo] = useState(null);   // captura de ticket viejo o null
  const [ledger, setLedger] = useState(null); // detalle (cargos/abonos) del estado de cuenta
  useEffect(()=>{
    if(!estado || !estado.id){ setLedger(null); return; }
    setLedger(undefined); // cargando
    fetch("/api/statement?customerId="+estado.id)
      .then(function(r){ return r.ok?r.json():null; })
      .then(function(d){ setLedger(d && Array.isArray(d.ledger) ? d : null); })
      .catch(function(){ setLedger(null); });
  }, [estado]);
  const goTo = (m)=> window.__cgGo && window.__cgGo(m);
  const waRecordatorio = (c)=> window.open(
    "https://wa.me/?text=" + encodeURIComponent(
      "Hola " + c.cliente + ", le recordamos su saldo pendiente de " + mny(c.saldo) + ". ¡Gracias!"),
    "_blank");
  const data = OPS.cobranza.filter(c=>c.saldo>0);
  const total = data.reduce((s,c)=>s+c.saldo,0);
  const antig = (d)=> d<=30?["green",d+" días"] : d<=60?["amber",d+" días"] : ["red",d+" días"];
  return (
    <div>
      <ScreenHead title="Cobranza" desc="Cuentas por cobrar: pedidos a crédito y tickets viejos. Registra abonos y manda recordatorios."
        right={<Btn kind="outline" icon="plus" onClick={()=>setCargo({ clienteId:"", monto:"", concepto:"" })}>Capturar ticket viejo</Btn>} />
      <SlotC id="cobranza" ai={ai} />
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:14, marginBottom:16 }}>
        <Card pad={18} style={{ background:Cx.redWash, borderColor:"transparent" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <Overline color={Cx.red}>Total por cobrar</Overline><Icon name="hand-coins" size={18} color={Cx.red} />
          </div>
          <Stat value={mnyk(total)} color={Cx.red} size={32} />
          <div style={{ font:`500 12px/1 ${Fx.ui}`, color:Cx.red, marginTop:8 }}>{data.length} clientes con saldo</div>
        </Card>
        <Card pad={18}>
          <Overline style={{ marginBottom:10 }}>Vencido +60 días</Overline>
          <Stat value={mnyk(data.filter(c=>c.dias>60).reduce((s,c)=>s+c.saldo,0))} color={Cx.ink} size={32} />
          <div style={{ font:`500 12px/1 ${Fx.ui}`, color:Cx.inkSoft, marginTop:8 }}>Prioriza estos recordatorios</div>
        </Card>
      </div>
      <Card pad={0} style={{ overflow:"hidden" }}>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", minWidth:700 }}>
            <thead><tr style={{ background:Cx.paper2 }}>
              <th style={thBase("left")}>Cliente</th><th style={thBase("right")}>Cargos</th>
              <th style={thBase("right")}>Abonos</th><th style={thBase("right")}>Saldo</th>
              <th style={thBase("left")}>Antigüedad</th><th style={thBase("center")}>Acciones</th>
            </tr></thead>
            <tbody>
              {data.map((c,i)=>{
                const [tone,lab]=antig(c.dias);
                return (
                  <tr key={i} style={{ borderTop:`1px solid ${Cx.lineSoft}` }}>
                    <td style={{ padding:"13px 14px", font:`700 13.5px/1 ${Fx.ui}`, color:Cx.ink }}>{c.cliente}</td>
                    <td style={{ padding:"13px 14px", textAlign:"right", font:`500 13px/1 ${Fx.mono}`, color:Cx.ink80 }}>{mny(c.cargos)}</td>
                    <td style={{ padding:"13px 14px", textAlign:"right", font:`500 13px/1 ${Fx.mono}`, color:Cx.green }}>{mny(c.abonos)}</td>
                    <td style={{ padding:"13px 14px", textAlign:"right", font:`700 13.5px/1 ${Fx.mono}`, color:Cx.red }}>{mny(c.saldo)}</td>
                    <td style={{ padding:"13px 14px" }}><Badge tone={tone}>{lab}</Badge></td>
                    <td style={{ padding:"13px 14px" }}>
                      <div style={{ display:"flex", gap:7, justifyContent:"center", alignItems:"center" }}>
                        <Btn kind="green" size="sm" icon="banknote"
                          onClick={()=>setAbono({ id:c.id, nombre:c.cliente, saldo:c.saldo })}>Abonar</Btn>
                        <Kebab items={[
                          { label:"Registrar abono", icon:"banknote", onClick:()=>setAbono({ id:c.id, nombre:c.cliente, saldo:c.saldo }) },
                          { label:"Estado de cuenta", icon:"file-text", onClick:()=>setEstado(c) },
                          { label:"Recordatorio WhatsApp", icon:"message-circle", onClick:()=>waRecordatorio(c) },
                          { label:"Ver pedidos a crédito", icon:"receipt-text", onClick:()=>goTo("pedidos") },
                        ]} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <AbonarModal open={!!abono} cliente={abono} onClose={()=>setAbono(null)}
        onAbono={(a)=>{
          if (abono && abono.id && window.CG.write) {
            window.CG.write("abono", { customerId:abono.id, amount:a.monto, method:a.metodo, notes:a.nota })
              .then(function(r){ if (r && r.ok && window.CG.refresh) window.CG.refresh(); });
          }
          setAbono(null);
        }} />
      <Modal open={!!estado} onClose={()=>setEstado(null)} icon="file-text" title="Estado de cuenta"
        width={460} subtitle={estado ? `Cliente: ${estado.cliente}` : ""}
        footer={<>
          <Btn kind="outline" onClick={()=>setEstado(null)}>Cerrar</Btn>
          <Btn kind="green" icon="banknote" onClick={()=>{ const c=estado; setEstado(null); setAbono({ id:c.id, nombre:c.cliente, saldo:c.saldo }); }}>Abonar</Btn>
        </>}>
        {estado && (
          <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
            {[["Cargos", estado.cargos, Cx.ink80],["Abonos", estado.abonos, Cx.green],["Saldo pendiente", estado.saldo, Cx.red]].map(([k,v,col],i)=>(
              <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"11px 2px",
                borderTop: i>0?`1px solid ${Cx.lineSoft}`:"none" }}>
                <span style={{ font:`600 13px/1 ${Fx.ui}`, color:Cx.inkSoft }}>{k}</span>
                <span style={{ font:`700 15px/1 ${Fx.mono}`, color:col }}>{mny(v)}</span>
              </div>
            ))}
            <div style={{ marginTop:10, font:`500 11.5px/1.4 ${Fx.ui}`, color:Cx.inkFaint }}>
              Antigüedad del saldo: {estado.dias} días.
            </div>
            {ledger===undefined && <div style={{ marginTop:12, font:`500 12px/1 ${Fx.ui}`, color:Cx.inkFaint }}>Cargando movimientos…</div>}
            {ledger && ledger.ledger && ledger.ledger.length>0 && (
              <div style={{ marginTop:12 }}>
                <div style={{ font:`700 11px/1 ${Fx.ui}`, letterSpacing:"0.05em", textTransform:"uppercase", color:Cx.inkFaint, marginBottom:6 }}>Movimientos</div>
                <div style={{ maxHeight:220, overflowY:"auto", display:"flex", flexDirection:"column", gap:1 }}>
                  {ledger.ledger.map(function(m){ return (
                    <div key={m.tipo+"-"+m.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"9px 2px", borderTop:`1px solid ${Cx.lineSoft}` }}>
                      <div style={{ minWidth:0 }}>
                        <div style={{ font:`600 12.5px/1.2 ${Fx.ui}`, color:Cx.ink, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{m.concepto}</div>
                        <div style={{ font:`500 10.5px/1 ${Fx.mono}`, color:Cx.inkFaint, marginTop:3 }}>{m.fecha||""}</div>
                      </div>
                      <span style={{ font:`700 13px/1 ${Fx.mono}`, color: m.tipo==="abono"?Cx.green:Cx.ink80, flexShrink:0, marginLeft:10 }}>
                        {m.tipo==="abono" ? "−"+mny(m.abono) : mny(m.cargo)}
                      </span>
                    </div>
                  ); })}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
      <Modal open={!!cargo} onClose={()=>setCargo(null)} icon="plus" title="Capturar ticket viejo" width={460}
        subtitle="Registra un cargo a crédito de un cliente (deuda previa)."
        footer={<>
          <Btn kind="outline" onClick={()=>setCargo(null)}>Cancelar</Btn>
          <Btn kind="green" icon="check" onClick={()=>{
            if (cargo && cargo.clienteId && parseFloat(cargo.monto)>0 && window.CG.write) {
              window.CG.write("cargo", { customerId:Number(cargo.clienteId), amount:parseFloat(cargo.monto), concept:cargo.concepto||"Ticket viejo" })
                .then(function(r){ if(r&&r.ok&&window.CG.refresh) window.CG.refresh(); });
            }
            setCargo(null);
          }}>Guardar cargo</Btn>
        </>}>
        {cargo && (
          <div style={{ display:"grid", gap:11 }}>
            <select value={cargo.clienteId} onChange={e=>setCargo({ ...cargo, clienteId:e.target.value })}
              style={{ font:`600 14px/1 ${Fx.ui}`, color:Cx.ink, background:Cx.paper2, border:`1px solid ${Cx.line}`, borderRadius:10, padding:"12px 13px", outline:"none" }}>
              <option value="">Selecciona cliente…</option>
              {(window.CG.ops.clientes||[]).map(c=> <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
            <input placeholder="Monto $" type="number" inputMode="decimal" value={cargo.monto}
              onChange={e=>setCargo({ ...cargo, monto:e.target.value })}
              style={{ font:`600 14px/1 ${Fx.mono}`, color:Cx.ink, background:Cx.paper2, border:`1px solid ${Cx.line}`, borderRadius:10, padding:"12px 13px", outline:"none" }} />
            <input placeholder="Concepto (opcional)" value={cargo.concepto}
              onChange={e=>setCargo({ ...cargo, concepto:e.target.value })}
              style={{ font:`500 14px/1 ${Fx.ui}`, color:Cx.ink, background:Cx.paper2, border:`1px solid ${Cx.line}`, borderRadius:10, padding:"12px 13px", outline:"none" }} />
          </div>
        )}
      </Modal>
    </div>
  );
}

window.PedidosScreen = PedidosScreen;
window.ClientesScreen = ClientesScreen;
window.CobranzaScreen = CobranzaScreen;
