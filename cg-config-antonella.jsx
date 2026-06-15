/* ============================================================
   CENTRO DE NOTIFICACIONES + CONFIG ANTONELLA
   ============================================================ */

const { useState, useEffect } = React;

/* Centro de notificaciones (modal) */
function NotificationCenter({ open, onClose }) {
  const [notifs, setNotifs] = useState([
    { id:1, tipo:"alerta", titulo:"Merma fuera de rango", desc:"El lomo de hoy tiene 15% merma vs 12% normal", time:"hace 23 min", read:false },
    { id:2, tipo:"info", titulo:"Pedido #358 pesado", desc:"Listo para entrega a Abarrotes El Sol", time:"hace 1 hora", read:true },
    { id:3, tipo:"aviso", titulo:"Saldo vencido", desc:"Abarrotes El Sol vence hoy. Recordatorio enviado.", time:"hace 2 horas", read:true },
  ]);

  const markAsRead = (id) => {
    setNotifs(ns => ns.map(n => n.id === id ? {...n, read:true} : n));
  };

  const unread = notifs.filter(n => !n.read).length;

  return (
    <div style={{ position:"fixed", inset:0, zIndex:200, background:"rgba(0,0,0,0.6)", display: open?"flex":"none", 
      justifyContent:"flex-end", alignItems:"flex-start", padding:"16px" }}>
      <div style={{ width:420, maxHeight:"88vh", overflowY:"auto", background:"#fff", borderRadius:14, boxShadow:"0 10px 40px rgba(0,0,0,0.2)" }}>
        {/* HEADER */}
        <div style={{ padding:"16px 18px", borderBottom:"1px solid #eee", display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:40, height:40, borderRadius:"50%", background:"#c41e3a", display:"grid", placeItems:"center", color:"#fff", fontSize:18 }}>🔔</div>
          <div style={{ flex:1 }}>
            <div style={{ font:"700 15px/1 Archivo", color:"#222" }}>Avisos de iAntonella</div>
            <div style={{ font:"500 12px/1 Archivo", color:"#999", marginTop:2 }}>
              {unread > 0 ? `${unread} pendiente${unread>1?"s":""}` : "Todo en orden"}
            </div>
          </div>
          <button onClick={onClose} style={{ width:32, height:32, border:"none", background:"#f5f5f5", borderRadius:6,
            cursor:"pointer", fontSize:18, display:"grid", placeItems:"center" }}>✕</button>
        </div>

        {/* LISTA */}
        {notifs.length > 0 ? (
          <div style={{ padding:"12px" }}>
            {notifs.map(n => (
              <button key={n.id} onClick={()=>markAsRead(n.id)} style={{ width:"100%", textAlign:"left", padding:"12px 14px", marginBottom:8,
                borderRadius:10, border:`1px solid ${n.read?"#eee":"#c41e3a"}`, background: n.read?"#f9f9f9":"#fff3f5",
                cursor:"pointer" }}>
                <div style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                  <div style={{ width:8, height:8, borderRadius:"50%", background: n.read?"#ccc":"#c41e3a", marginTop:6, flexShrink:0 }} />
                  <div style={{ flex:1 }}>
                    <div style={{ font:"600 13px/1 Archivo", color:"#222" }}>{n.titulo}</div>
                    <div style={{ font:"500 12px/1.3 Archivo", color:"#777", marginTop:4 }}>{n.desc}</div>
                    <div style={{ font:"500 11px/1 Archivo", color:"#bbb", marginTop:6 }}>{n.time}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div style={{ padding:"40px 20px", textAlign:"center", color:"#999" }}>
            <div style={{ font:"500 18px/1.4 Archivo" }}>No hay nada pendiente. 🎉</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* Configuración de iAntonella (pantalla completa) */
function ConfigAntonelaScreen({ ai }) {
  const [activeTab, setActiveTab] = useState("que-es");
  const [model, setModel] = useState("GPT-4.5");
  const [prompt, setPrompt] = useState("Eres iAntonella, asistente de CÁRNICOS GUSTAVO...");
  const [habilidades, setHabilidades] = useState([
    { id:"estado-inventario", nombre:"Estado del inventario", desc:"Monitorea stock en cámara, fría y a fresco", enabled:true },
    { id:"detalles-producto", nombre:"Detalle de un producto", desc:"Costo, peso, variantes de corte", enabled:true },
    { id:"demanda-abierta", nombre:"Demanda / pedidos abiertos", desc:"Qué pidieron los clientes", enabled:true },
  ]);

  return (
    <div style={{ maxWidth:900, margin:"0 auto" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <div>
          <h1 style={{ margin:"0 0 6px", fontSize:28, fontWeight:700 }}>Configurar iAntonella</h1>
          <p style={{ margin:0, fontSize:13, color:"#666" }}>Cómo piensa y responde tu asistente inteligente.</p>
        </div>
        <button style={{ padding:"10px 16px", background:"#c41e3a", color:"#fff", border:"none", borderRadius:6,
          cursor:"pointer", fontWeight:700 }}>Guardar cambios</button>
      </div>

      {/* TABS */}
      <div style={{ display:"flex", gap:12, marginBottom:20, borderBottom:"1px solid #ddd", paddingBottom:12 }}>
        {[["que-es","¿Qué es iAntonella?"],["modelo","Modelo de iA"],["instruccion","Instrucción principal"],["habilidades","Habilidades"]].map(([id,lab])=>(
          <button key={id} onClick={()=>setActiveTab(id)} style={{
            padding:"10px 14px", fontSize:13, fontWeight:600, border:"none", background:"transparent", cursor:"pointer",
            borderBottom: activeTab===id?"3px solid #c41e3a":"none", color: activeTab===id?"#222":"#999" }}>
            {lab}
          </button>
        ))}
      </div>

      {/* CONTENIDO */}
      {activeTab === "que-es" && (
        <div style={{ background:"#f9f9f9", padding:20, borderRadius:10, marginBottom:20 }}>
          <p style={{ margin:"0 0 12px", fontSize:13, lineHeight:1.6, color:"#555" }}>
            iAntonella es la inteligencia del sistema de CÁRNICOS GUSTAVO. Tiene acceso a todo: inventario, recetas, pedidos, 
            cobranza y pesaje. Cada acción que hagas, ella la ve; cada dato que generas, lo aprende. Puede sugerir, avisar, 
            enseñar y automatizar tareas del día a día.
          </p>
          <p style={{ margin:"0 0 12px", fontSize:13, lineHeight:1.6, color:"#555" }}>
            Usa un modelo de lenguaje actual (GPT-4.5 o Claude 3.5), con una instrucción personalizada (system prompt) 
            que define su rol, contexto y habilidades disponibles.
          </p>
          <div style={{ background:"#fff", padding:12, borderRadius:8, borderLeft:"3px solid #c41e3a", fontSize:12, color:"#777" }}>
            <strong>Nota:</strong> Los datos que procesa iAntonella están encriptados en tránsito y almacenados en Supabase 
            con acceso restringido. No se comparten con terceros.
          </div>
        </div>
      )}

      {activeTab === "modelo" && (
        <div style={{ background:"#f9f9f9", padding:20, borderRadius:10, marginBottom:20 }}>
          <label style={{ display:"block", marginBottom:8, font:"700 13px/1 Archivo", color:"#222" }}>Proveedor y modelo</label>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:12, marginBottom:16 }}>
            {["GPT-4.5 — más rápido","Claude 3.5 — más preciso","Llama 3 — económico"].map((opt,i)=>(
              <button key={i} onClick={()=>setModel(opt.split(" ")[0])} style={{
                padding:12, border:`2px solid ${opt.includes(model)?"#c41e3a":"#ddd"}`, borderRadius:8,
                background: opt.includes(model)?"#fff3f5":"#fff", cursor:"pointer", fontSize:12, fontWeight:600 }}>
                {opt}
              </button>
            ))}
          </div>
          <p style={{ margin:0, fontSize:12, color:"#999" }}>Costo de tokens, latencia y precisión varían por proveedor.</p>
        </div>
      )}

      {activeTab === "instruccion" && (
        <div style={{ background:"#f9f9f9", padding:20, borderRadius:10, marginBottom:20 }}>
          <label style={{ display:"block", marginBottom:8, font:"700 13px/1 Archivo", color:"#222" }}>System prompt</label>
          <textarea value={prompt} onChange={e=>setPrompt(e.target.value)} style={{
            width:"100%", minHeight:200, padding:12, border:"1px solid #ddd", borderRadius:8,
            fontFamily:"monospace", fontSize:12, lineHeight:1.5 }} />
          <p style={{ margin:"8px 0 0", fontSize:11, color:"#999" }}>Instrucción que define el comportamiento de iAntonella.</p>
        </div>
      )}

      {activeTab === "habilidades" && (
        <div style={{ background:"#f9f9f9", padding:20, borderRadius:10 }}>
          <p style={{ margin:"0 0 16px", fontSize:13, color:"#666" }}>Activa/desactiva lo que puede hacer iAntonella en cada módulo.</p>
          {habilidades.map(h=>(
            <div key={h.id} style={{ background:"#fff", padding:14, marginBottom:10, borderRadius:8, display:"flex", gap:12, alignItems:"center" }}>
              <input type="checkbox" checked={h.enabled} onChange={e=>
                setHabilidades(hs => hs.map(x => x.id===h.id?{...x,enabled:e.target.checked}:x))} 
                style={{ width:18, height:18, cursor:"pointer" }} />
              <div style={{ flex:1 }}>
                <div style={{ font:"600 13px/1 Archivo", color:"#222" }}>{h.nombre}</div>
                <div style={{ font:"500 12px/1 Archivo", color:"#999", marginTop:4 }}>{h.desc}</div>
              </div>
              <input type="radio" style={{ cursor:"pointer" }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

window.NotificationCenter = NotificationCenter;
window.ConfigAntonelaScreen = ConfigAntonelaScreen;
