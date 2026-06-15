/* ============================================================
   Pantallas reskin — Cárnicos Gustavo
   ============================================================ */
const Cs = window.CG.color;
const Fs = window.CG.font;
const D  = window.CG.data;
const A  = window.CG.antonella;

const money = (n) => "$" + n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const moneyk = (n) => "$" + n.toLocaleString("es-MX");

/* helper: slot de Antonella conectado a la App */
function Slot({ id, ai }) {
  const d = (A[id] || A.default).slot;
  return <AntonellaSlot data={d} onChip={(t)=>ai.chip(t)} onOpen={()=>ai.open()} onNav={(m)=>window.__cgGo&&window.__cgGo(m)} />;
}

/* ---------------- PANEL ---------------- */
function PanelScreen({ ai }) {
  const p = D.panel;
  const [hide, setHide] = useState(()=> { try { return localStorage.getItem("cg_hide_default")!=="0"; } catch(e){ return true; } }); // preferencia en Configuración
  const m = (v)=> hide ? "•  •  •" : moneyk(v);
  const totalCat = p.ingresosCat.reduce((s,x)=>s+x.v,0);
  // donut conic
  let acc = 0;
  const stops = p.ingresosCat.map(x=>{ const a=acc; acc+=x.v/totalCat*100; return `${Cs[x.c]} ${a}% ${acc}%`; }).join(",");
  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:22, flexWrap:"wrap",
        background:Cs.cream, border:`1px solid ${Cs.line}`, borderRadius:20,
        padding:"16px 24px", marginBottom:18, boxShadow:Cs.shadow }}>
        <img src="assets/logo-gustavo.png" alt="Cárnicos Gustavo"
          style={{ height:138, width:"auto", display:"block", flexShrink:0 }} />
        <div style={{ flex:1, minWidth:220 }}>
          <div style={{ font:`700 11px/1 ${Fs.ui}`, letterSpacing:"0.22em", textTransform:"uppercase",
            color:"#9E3326", marginBottom:9 }}>Centro de Distribución</div>
          <h1 style={{ margin:0, font:`400 34px/0.95 ${Fs.display}`, color:"#211C19", letterSpacing:"0.01em" }}>
            Buen día, Gustavo
          </h1>
          <p style={{ margin:"10px 0 0", font:`400 14px/1.5 ${Fs.ui}`, color:"#6B625A", textWrap:"pretty" }}>
            Hoy: 80 canales en piso · 1 pedido en cola de cobro · 2 cuentas por cobrar vencen hoy.
            <span style={{ color:"#9A9087" }}>  ·  {D.panel ? "Jueves 12 de junio, 2026" : ""}</span>
          </p>
        </div>
        <Btn kind="outline" icon={hide?"eye":"eye-off"}
          onClick={()=> hide ? (window.CG.requirePin ? window.CG.requirePin("privacy", ()=>setHide(false), { msg:"Ingresa el PIN para ver los montos" }) : setHide(false)) : setHide(true)}
          style={{ background:"#FBF7EF", color:"#211C19", border:"1px solid rgba(33,28,25,0.14)" }}>
          {hide?"Mostrar montos":"Ocultar montos"}
        </Btn>
      </div>
      <Slot id="panel" ai={ai} />
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:14, marginBottom:14 }}>
        {[["Ingresos totales","trending-up",p.ingresos,Cs.ink,"Ventas completadas"],
          ["Gastos totales","wallet",p.gastos,Cs.ink,"Egresos completados"],
          ["Ganancia neta","badge-dollar-sign",p.ganancia,Cs.green,`Margen ${p.margen}%`]].map(([t,ic,v,col,sub],i)=>(
          <Card key={i} pad={18}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
              <Overline>{t}</Overline>
              <Icon name={ic} size={18} color={i===2?Cs.green:Cs.inkFaint} />
            </div>
            <Stat value={hide?"• • •":moneyk(v)} color={col} size={32} />
            <div style={{ font:`500 12px/1 ${Fs.ui}`, color:Cs.inkSoft, marginTop:8 }}>{sub}</div>
          </Card>
        ))}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))", gap:14 }}>
        <Card>
          <Overline style={{ marginBottom:4 }}>Ingresos por categoría</Overline>
          <div style={{ font:`500 12px/1 ${Fs.ui}`, color:Cs.inkSoft, marginBottom:16 }}>Distribución de ventas</div>
          <div style={{ display:"flex", gap:22, alignItems:"center", flexWrap:"wrap" }}>
            <div style={{ width:150, height:150, borderRadius:"50%", flexShrink:0,
              background:`conic-gradient(${stops})`, position:"relative" }}>
              <div style={{ position:"absolute", inset:34, borderRadius:"50%", background:Cs.paper,
                display:"grid", placeItems:"center", textAlign:"center" }}>
                <div>
                  <div style={{ font:`400 20px/1 ${Fs.display}`, color:Cs.ink }}>{hide?"•••":moneyk(totalCat)}</div>
                  <div style={{ font:`600 10px/1 ${Fs.ui}`, color:Cs.inkSoft, marginTop:3, letterSpacing:"0.06em" }}>TOTAL</div>
                </div>
              </div>
            </div>
            <div style={{ flex:1, minWidth:140 }}>
              {p.ingresosCat.map((x,i)=>(
                <div key={i} style={{ display:"flex", alignItems:"center", gap:9, padding:"6px 0",
                  borderBottom:i<p.ingresosCat.length-1?`1px solid ${Cs.lineSoft}`:"none" }}>
                  <span style={{ width:10, height:10, borderRadius:3, background:Cs[x.c] }} />
                  <span style={{ flex:1, font:`600 13px/1 ${Fs.ui}`, color:Cs.ink80 }}>{x.n}</span>
                  <span style={{ font:`500 13px/1 ${Fs.mono}`, color:Cs.inkSoft }}>{hide?"•••":moneyk(x.v)}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
        <Card>
          <Overline style={{ marginBottom:4 }}>Flujo de caja</Overline>
          <div style={{ font:`500 12px/1 ${Fs.ui}`, color:Cs.inkSoft, marginBottom:18 }}>Volumen diario · últimas 12 jornadas</div>
          <div style={{ display:"flex", alignItems:"flex-end", gap:7, height:150 }}>
            {p.flujo.map((v,i)=>(
              <div key={i} style={{ flex:1, height:`${v}%`, borderRadius:"5px 5px 0 0",
                background: i===p.flujo.length-1?Cs.red:Cs.tan, opacity:i===p.flujo.length-1?1:0.55,
                transition:"height .5s ease" }} />
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ---------------- COMPRA DEL DÍA ---------------- */
function CompraScreen({ ai }) {
  const c = D.compra;
  const [fecha, setFecha] = useState(c.fecha);
  const [provs, setProvs] = useState(c.proveedores);
  const sum = (k)=> provs.reduce((s,p)=>s+(Number(p[k])||0),0);
  const hoy = ()=> setFecha(new Date().toLocaleDateString("es-MX",{ day:"2-digit", month:"2-digit", year:"numeric" }));
  const addProv = ()=> setProvs(a=>[...a, { nombre:"", americanos:0, nacionales:0, canales:0, kgPie:0, precioKg:0, kgCanal:0 }]);
  // Edición inline: al cambiar un campo recalculo Canales (= americanos+nacionales) y Kg/canal.
  const updateProv = (i, patch)=> setProvs(arr=>arr.map((p,idx)=>{
    if (idx!==i) return p;
    const np = { ...p, ...patch };
    np.canales = (Number(np.americanos)||0) + (Number(np.nacionales)||0);
    np.kgCanal = np.canales>0 ? (Number(np.kgPie)||0)/np.canales : 0;
    return np;
  }));
  const removeProv = (i)=> setProvs(arr=>arr.filter((_,idx)=>idx!==i));
  const chips = [
    ["Americanos", sum("americanos"), Cs.red, Cs.redWash],
    ["Nacionales", sum("nacionales"), Cs.green, Cs.greenWash],
    ["Canales (total)", sum("canales"), Cs.ink, "transparent"],
    ["Kg en pie", sum("kgPie").toLocaleString("es-MX"), Cs.ink, "transparent"],
    ["Kg / canal", sum("canales") ? (sum("kgPie")/sum("canales")).toFixed(1) : "0", Cs.ink, "transparent"],
  ];
  return (
    <div>
      <ScreenHead title="Compra del día" desc="El día empieza aquí: registra la compra en pie por proveedor. Es la base del rendimiento."
        right={<Btn kind="dark" icon="save" onClick={()=>{
          if (window.CG.write) window.CG.write("purchases.save", {
            rows: provs.map(pr=>({ supplier:pr.nombre, americanos:pr.americanos, nacionales:pr.nacionales, canales:pr.canales, kgPie:pr.kgPie, precioKg:pr.precioKg })),
          }).then(function(r){ if(r&&r.ok&&window.CG.refresh) window.CG.refresh(); });
          window.__cgGo && window.__cgGo("rendimiento");
        }}>Guardar compra del día</Btn>} />
      <Card pad={16} style={{ marginBottom:14, display:"flex", gap:12, flexWrap:"wrap", alignItems:"flex-end" }}>
        <div>
          <Overline style={{ marginBottom:7 }}>Día de operación</Overline>
          <div style={{ display:"inline-flex", alignItems:"center", gap:9, border:`1px solid ${Cs.line}`,
            borderRadius:11, padding:"11px 14px", font:`600 14px/1 ${Fs.mono}`, color:Cs.ink, background:Cs.paper2 }}>
            <Icon name="calendar" size={16} color={Cs.inkSoft} /> {fecha}
          </div>
        </div>
        <div style={{ marginLeft:"auto", display:"flex", gap:9 }}>
          <Btn kind="outline" icon="rotate-ccw" onClick={hoy}>Hoy</Btn>
          <Btn kind="ghost" onClick={()=>setProvs([])}>Empezar de ceros</Btn>
        </div>
      </Card>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:12, marginBottom:16 }}>
        {chips.map(([t,v,col,bg],i)=>(
          <Card key={i} pad={16} style={{ background: bg==="transparent"?Cs.paper:bg, borderColor: bg==="transparent"?Cs.line:"transparent" }}>
            <div style={{ font:`600 12px/1.2 ${Fs.ui}`, color: bg==="transparent"?Cs.inkSoft:col, marginBottom:9,
              display:"flex", alignItems:"center", gap:6 }}>
              {i<2 && <Icon name="piggy-bank" size={14} color={col} />}{t}
            </div>
            <Stat value={v} color={col} size={30} />
          </Card>
        ))}
      </div>
      <Slot id="compra" ai={ai} />
      <Card>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <h3 style={{ margin:0, font:`700 16px/1 ${Fs.ui}`, color:Cs.ink }}>Compra en pie por proveedor</h3>
          <Btn kind="outline" size="sm" icon="plus" onClick={addProv}>Agregar proveedor</Btn>
        </div>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", minWidth:640 }}>
            <thead>
              <tr>{["Proveedor","Americanos","Nacionales","Canales","Kg en pie","$ / kg","Kg/canal",""].map((h,i)=>(
                <th key={i} style={{ textAlign:i===0?"left":"right", font:`600 11px/1 ${Fs.ui}`, letterSpacing:"0.06em",
                  textTransform:"uppercase", color:Cs.inkFaint, padding:"0 12px 12px" }}>{h}</th>))}</tr>
            </thead>
            <tbody>
              {provs.length===0 && (
                <tr><td colSpan={8} style={{ padding:"22px 12px", textAlign:"center", font:`500 13px/1 ${Fs.ui}`, color:Cs.inkFaint }}>
                  Sin proveedores. Usa "Agregar proveedor" para empezar.</td></tr>
              )}
              {provs.map((p,i)=>(
                <tr key={i} style={{ borderTop:`1px solid ${Cs.lineSoft}` }}>
                  <td style={{ padding:"8px 12px 8px 8px" }}>
                    <input value={p.nombre} onChange={e=>updateProv(i,{ nombre:e.target.value })} placeholder="Nombre del proveedor"
                      style={{ width:"100%", minWidth:150, font:`700 14px/1 ${Fs.ui}`, color:Cs.ink, background:Cs.paper2,
                        border:`1px solid ${Cs.line}`, borderRadius:8, padding:"9px 11px", outline:"none" }} />
                  </td>
                  <EditCell value={p.americanos} onChange={v=>updateProv(i,{ americanos:v })} accent={Number(p.americanos)>0?Cs.red:null} />
                  <EditCell value={p.nacionales} onChange={v=>updateProv(i,{ nacionales:v })} accent={Number(p.nacionales)>0?Cs.green:null} />
                  <td style={{ textAlign:"right", padding:"14px 12px", font:`700 14px/1 ${Fs.mono}`, color:Cs.ink }}>{Number(p.canales)||0}</td>
                  <EditCell value={p.kgPie} onChange={v=>updateProv(i,{ kgPie:v })} />
                  <EditCell value={p.precioKg} onChange={v=>updateProv(i,{ precioKg:v })} step="0.1" />
                  <td style={{ textAlign:"right", padding:"14px 12px", font:`500 14px/1 ${Fs.mono}`, color:Cs.inkSoft }}>{(Number(p.kgCanal)||0).toFixed(1)}</td>
                  <td style={{ textAlign:"center", padding:"8px 6px" }}>
                    <button onClick={()=>removeProv(i)} title="Quitar proveedor" className="cg-btn" style={{ width:30, height:30,
                      borderRadius:8, border:`1px solid ${Cs.line}`, background:Cs.paper2, cursor:"pointer", display:"grid", placeItems:"center" }}>
                      <Icon name="trash-2" size={15} color={Cs.inkSoft} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ margin:"14px 4px 0", font:`400 12.5px/1.5 ${Fs.ui}`, color:Cs.inkSoft, textWrap:"pretty" }}>
          1 americano = 1 canal completo · 1 nacional = 1 lado Lomo + 1 lado Espilomo. El total de kg alimenta el Rendimiento.
        </p>
      </Card>
    </div>
  );
}
function Cell({ v, accent, bold }) {
  return <td style={{ textAlign:"right", padding:"14px 12px",
    font:`${bold?700:500} 14px/1 ${Fs.mono}`, color: accent || (bold?Cs.ink:Cs.ink80) }}>{v}</td>;
}
/* Celda editable (input numérico) para capturar la compra en pie por proveedor. */
function EditCell({ value, onChange, accent, step }) {
  return (
    <td style={{ padding:"8px" }}>
      <input value={value} onChange={e=>onChange(e.target.value)} type="number" step={step} inputMode="decimal"
        onFocus={e=>{ try{ e.target.select(); }catch(_){} }}
        style={{ width:"100%", maxWidth:108, textAlign:"right", font:`600 14px/1 ${Fs.mono}`,
          color: accent||Cs.ink, background:Cs.paper2, border:`1px solid ${Cs.line}`, borderRadius:8,
          padding:"9px 10px", outline:"none", minWidth:0, marginLeft:"auto", display:"block" }} />
    </td>
  );
}

window.money = money;
window.moneyk = moneyk;
window.Slot = Slot;
window.PanelScreen = PanelScreen;
window.CompraScreen = CompraScreen;
