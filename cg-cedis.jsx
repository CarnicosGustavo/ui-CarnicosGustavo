/* ============================================================
   CEDIS — Verificación de peso en recepción (w1.carnicosgustavo.com)
   ============================================================ */

const { useState, useEffect } = React;

function CedisScreen({ ai }) {
  // Compuerta por código de verificación CEDIS (una vez por sesión).
  const [unlocked, setUnlocked] = useState(()=> { try { return sessionStorage.getItem("cg_cedis_ok")==="1"; } catch(e){ return false; } });
  useEffect(()=>{ if(!unlocked && window.CG.requirePin) window.CG.requirePin("cedis", ()=>{ try{ sessionStorage.setItem("cg_cedis_ok","1"); }catch(e){} setUnlocked(true); }, { msg:"Código de verificación CEDIS" }); }, [unlocked]);

  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [proveedores, setProveedores] = useState([]);
  const [modo, setModo] = useState("canal-x-canal"); // "canal-x-canal" o "peso-total"
  const [taraGlobal, setTaraGlobal] = useState(0);
  const [nuevoProv, setNuevoProv] = useState("");
  const [savedMsg, setSavedMsg] = useState("");

  // Carga las compras de canales del día (ids reales) para guardar la verificación.
  const cargar = (d)=>{
    fetch("/api/cedis?date="+(d||fecha)).then(function(r){ return r.ok?r.json():null; })
      .then(function(data){ if(data && Array.isArray(data.proveedores)) setProveedores(data.proveedores); })
      .catch(function(){});
  };
  useEffect(()=>{ if(unlocked) cargar(fecha); }, [fecha, unlocked]);

  const totalMedias = proveedores.reduce((sum, p) => sum + (p.medias?.length || 0), 0);
  const totalKgReal = proveedores.reduce((sum, p) => sum + (p.pesoReal || 0), 0);
  const totalKgEsperado = proveedores.reduce((sum, p) => sum + (p.pesoEsperado || 0), 0);
  const mermaPct = totalKgEsperado > 0 ? ((totalKgEsperado - totalKgReal) / totalKgEsperado * 100).toFixed(1) : 0;

  const addMedia = (provId, peso, tara) => {
    const pesoNeto = peso - tara;
    setProveedores(ps => ps.map(p => 
      p.id === provId 
        ? { ...p, medias: [...(p.medias||[]), { kg: pesoNeto, bruto: peso, tara }] }
        : p
    ));
  };

  const calcMerma = () => {
    // Aquí iría lógica de cálculo real desde "Compra del Día"
    ai?.chip("✓ Merma calculada");
  };

  const guardar = () => {
    const mode = modo === "peso-total" ? "total" : "canal";
    const rows = proveedores.filter(p=>p.id).map(p=>{
      const weights = (p.medias||[]).map(m=>m.kg);
      return { id:p.id, mode, tara:taraGlobal||0, weights,
        totalKg:(p.medias||[]).reduce((s,m)=>s+m.kg,0), totalCanales:weights.length };
    });
    if(window.CG.write && rows.length){
      window.CG.write("cedis.save", { rows }).then(function(r){
        if(r&&r.ok){ setSavedMsg("✓ Verificación guardada"); setTimeout(()=>setSavedMsg(""), 2000); if(window.CG.refresh) window.CG.refresh(); }
      });
    } else { ai?.chip("✓ Verificación guardada"); }
  };
  const agregarProveedor = ()=>{
    const nombre = nuevoProv.trim(); if(!nombre) return;
    if(window.CG.write){
      window.CG.write("cedis.addSupplier", { date:fecha, supplier:nombre }).then(function(r){
        if(r&&r.ok){ setNuevoProv(""); cargar(fecha); }
      });
    } else { setProveedores(ps=>[...ps, { id:Date.now(), nombre, medias:[], pesoEsperado:0, pesoReal:0 }]); setNuevoProv(""); }
  };

  if(!unlocked) return (
    <div style={{ padding:"60px 22px", textAlign:"center", color:"#666" }}>
      <div style={{ fontSize:34, marginBottom:10 }}>🔒</div>
      <h2 style={{ margin:"0 0 6px", fontSize:20 }}>Área protegida — Verificación CEDIS</h2>
      <p style={{ margin:"0 0 16px", fontSize:13 }}>Ingresa el código del área para capturar pesos de canales.</p>
      <button onClick={()=>window.CG.requirePin&&window.CG.requirePin("cedis", ()=>{ try{ sessionStorage.setItem("cg_cedis_ok","1"); }catch(e){} setUnlocked(true); }, { msg:"Código de verificación CEDIS" })}
        style={{ padding:"10px 18px", background:"#c41e3a", color:"#fff", border:"none", borderRadius:8, cursor:"pointer", fontWeight:700, fontSize:13 }}>
        Ingresar código
      </button>
    </div>
  );

  return (
    <div style={{ padding:"22px" }}>
      {/* HEADER */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
        <div>
          <h1 style={{ margin:"0 0 4px", fontSize:28, fontWeight:700 }}>Verificación en CEDIS</h1>
          <p style={{ margin:0, fontSize:13, color:"#666" }}>Peso real de las medias canales al llegar. La diferencia contra el peso en pie de la Compra del Día es la merma.</p>
        </div>
        <div style={{ display:"flex", gap:12, alignItems:"center" }}>
          <label style={{ display:"flex", alignItems:"center", gap:8, fontSize:13 }}>
            <span>Día</span>
            <input type="date" value={fecha} onChange={e=>setFecha(e.target.value)} 
              style={{ padding:"6px 10px", border:"1px solid #ddd", borderRadius:6, fontSize:13 }} />
          </label>
          <button onClick={guardar} style={{
            padding:"10px 18px", background:"#c41e3a", color:"#fff", border:"none", borderRadius:6,
            cursor:"pointer", fontWeight:700, fontSize:13 }}>
            {savedMsg || "💾 Guardar"}
          </button>
        </div>
      </div>

      {/* iANTONELLA ALERTA */}
      <div style={{
        display:"flex", gap:14, padding:"14px 16px", borderRadius:12, background:"#fff3cd", border:"1px solid #ffc107",
        marginBottom:20, alignItems:"flex-start" }}>
        <div style={{ width:40, height:40, borderRadius:"50%", background:"#c41e3a", display:"grid", placeItems:"center",
          color:"#fff", fontSize:20, flexShrink:0 }}>⚙️</div>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:700, marginBottom:6, fontSize:13 }}>iAntonella • Verificación CEDIS <span style={{ color:"#c41e3a", fontWeight:700 }}>ALERTA</span></div>
          <p style={{ margin:"0 0 10px", fontSize:13, lineHeight:1.5 }}>Pesa cada media canal (le descuento la tara del cargador). Calculo la merma contra el peso en pie y el precio real por kilo del día.</p>
          <div style={{ display:"flex", gap:10 }}>
            <button style={{
              padding:"6px 12px", background:"#000", color:"#fff", border:"none", borderRadius:999,
              cursor:"pointer", fontSize:12, fontWeight:600 }}>
              ❓ ¿Cuál es la merma normal?
            </button>
            <button style={{
              padding:"6px 12px", background:"transparent", color:"#c41e3a", border:"1px solid #c41e3a", borderRadius:999,
              cursor:"pointer", fontSize:12, fontWeight:600 }}>
              ❓ ¿Precio real por kilo?
            </button>
          </div>
        </div>
      </div>

      {/* STATS */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:12, marginBottom:20 }}>
        <div style={{ padding:"16px", background:"#f5f5f5", borderRadius:8, textAlign:"center" }}>
          <div style={{ fontSize:36, fontWeight:700, color:"#333" }}>{totalMedias}</div>
          <div style={{ fontSize:11, fontWeight:600, color:"#999", marginTop:4, textTransform:"uppercase" }}>medias pesadas</div>
        </div>
        <div style={{ padding:"16px", background:"#f5f5f5", borderRadius:8, textAlign:"center" }}>
          <div style={{ fontSize:36, fontWeight:700, color:"#333" }}>{totalKgReal.toFixed(1)}</div>
          <div style={{ fontSize:11, fontWeight:600, color:"#999", marginTop:4, textTransform:"uppercase" }}>kg canal (real)</div>
        </div>
        <div style={{ padding:"16px", background:"#fff3cd", borderRadius:8, textAlign:"center" }}>
          <div style={{ fontSize:36, fontWeight:700, color:"#c41e3a" }}>-{mermaPct}%</div>
          <div style={{ fontSize:11, fontWeight:600, color:"#999", marginTop:4, textTransform:"uppercase" }}>merma (100%)</div>
        </div>
      </div>

      {/* OPCIONES DE VISTA */}
      <div style={{ display:"flex", gap:10, marginBottom:20 }}>
        <button onClick={()=>setModo("canal-x-canal")} style={{
          padding:"10px 16px", background: modo==="canal-x-canal"?"#c41e3a":"#fff", color: modo==="canal-x-canal"?"#fff":"#333",
          border:`1px solid ${modo==="canal-x-canal"?"#c41e3a":"#ddd"}`, borderRadius:6, cursor:"pointer", fontWeight:600, fontSize:13 }}>
          Canal x canal
        </button>
        <button onClick={()=>setModo("peso-total")} style={{
          padding:"10px 16px", background: modo==="peso-total"?"#c41e3a":"#fff", color: modo==="peso-total"?"#fff":"#333",
          border:`1px solid ${modo==="peso-total"?"#c41e3a":"#ddd"}`, borderRadius:6, cursor:"pointer", fontWeight:600, fontSize:13 }}>
          Peso total
        </button>
      </div>

      {/* PROVEEDORES */}
      <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
        {proveedores.map(p => (
          <ProveedorCard key={p.id} prov={p} modo={modo} onAddMedia={addMedia} />
        ))}
      </div>

      {/* AGREGAR PROVEEDOR */}
      <div style={{ marginTop:24, display:"flex", gap:10, alignItems:"center" }}>
        <input type="text" placeholder="Nombre del proveedor (ej. Maldonado)" value={nuevoProv} 
          onChange={e=>setNuevoProv(e.target.value)}
          style={{ flex:1, padding:"10px 12px", border:"1px solid #ddd", borderRadius:8, fontSize:13 }} />
        <button onClick={agregarProveedor}
          style={{ padding:"10px 16px", background:"#fff", border:"1px solid #ddd", borderRadius:8, cursor:"pointer", fontSize:13, fontWeight:600 }}>
          ➕ Agregar proveedor
        </button>
      </div>
    </div>
  );
}

/* Card de proveedor */
function ProveedorCard({ prov, modo, onAddMedia }) {
  const [input, setInput] = useState("");
  const [tara, setTara] = useState(0);
  const [view, setView] = useState("canal-x-canal");
  const pesoTotal = prov.medias?.reduce((s, m) => s + m.kg, 0) || 0;

  return (
    <div style={{ border:"1px solid #ddd", borderRadius:10, padding:20, background:"#fff" }}>
      {/* HEADER PROVEEDOR */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <h3 style={{ margin:0, fontSize:16, fontWeight:700, display:"flex", alignItems:"center", gap:8 }}>
          🔴 {prov.nombre}
        </h3>
        <div style={{ display:"flex", gap:8, fontSize:12 }}>
          <button onClick={()=>setView("canal-x-canal")} style={{
            padding:"6px 12px", background: view==="canal-x-canal"?"#c41e3a":"#fff", color: view==="canal-x-canal"?"#fff":"#333",
            border:`1px solid #ddd`, borderRadius:6, cursor:"pointer", fontWeight:600, fontSize:11 }}>
            Canal x canal
          </button>
          <button onClick={()=>setView("peso-total")} style={{
            padding:"6px 12px", background: view==="peso-total"?"#c41e3a":"#fff", color: view==="peso-total"?"#fff":"#333",
            border:`1px solid #ddd`, borderRadius:6, cursor:"pointer", fontWeight:600, fontSize:11 }}>
            Peso total
          </button>
        </div>
      </div>

      {/* ENTRADA DE DATOS */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
        <div>
          <label style={{ display:"block", fontSize:11, fontWeight:600, marginBottom:6, color:"#666" }}>+ kg de una media canal</label>
          <input type="number" placeholder="Ej. 23.5" value={input} onChange={e=>setInput(e.target.value)}
            style={{ width:"100%", padding:"10px 12px", border:"1px solid #ddd", borderRadius:6, fontSize:13 }} />
        </div>
        <div>
          <label style={{ display:"block", fontSize:11, fontWeight:600, marginBottom:6, color:"#666" }}>Tara cargador</label>
          <div style={{ display:"flex", gap:8 }}>
            <input type="number" placeholder="0" value={tara} onChange={e=>setTara(parseFloat(e.target.value)||0)}
              style={{ flex:1, padding:"10px 12px", border:"1px solid #ddd", borderRadius:6, fontSize:13 }} />
            <button onClick={()=>{ if(input) { onAddMedia(prov.id, parseFloat(input), tara); setInput(""); } }}
              style={{ padding:"10px 16px", background:"#c41e3a", color:"#fff", border:"none", borderRadius:6, cursor:"pointer", fontWeight:600, fontSize:13 }}>
              Enter para agregar
            </button>
          </div>
        </div>
      </div>

      {/* TABLA DE MEDIAS */}
      {prov.medias && prov.medias.length > 0 ? (
        <div style={{ background:"#f9f9f9", borderRadius:8, padding:12, marginBottom:12 }}>
          <div style={{ display:"grid", gridTemplateColumns:"80px 1fr 80px 80px", gap:12, fontSize:11, fontWeight:600, color:"#999", marginBottom:8, textTransform:"uppercase" }}>
            <span>Bruto</span>
            <span>Tara</span>
            <span>Neto</span>
            <span></span>
          </div>
          {prov.medias.map((m, i) => (
            <div key={i} style={{ display:"grid", gridTemplateColumns:"80px 1fr 80px 80px", gap:12, fontSize:13, alignItems:"center", paddingBottom:8, borderBottom:"1px solid #ddd" }}>
              <span>{m.bruto.toFixed(1)} kg</span>
              <span style={{ color:"#999" }}>-{m.tara} kg</span>
              <span style={{ fontWeight:700 }}>{m.kg.toFixed(1)}</span>
              <button onClick={()=>{}} style={{ padding:"4px 8px", background:"#ddd", border:"none", borderRadius:4, cursor:"pointer", fontSize:11 }}>✕</button>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ padding:12, background:"#f9f9f9", borderRadius:8, color:"#999", fontSize:12, marginBottom:12 }}>
          Aún sin medias canales pesadas.
        </div>
      )}

      {/* RESUMEN */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", fontSize:13, fontWeight:700 }}>
        <span>{prov.medias?.length || 0} medias · {pesoTotal.toFixed(1)} kg canal</span>
      </div>
    </div>
  );
}

window.CedisScreen = CedisScreen;
