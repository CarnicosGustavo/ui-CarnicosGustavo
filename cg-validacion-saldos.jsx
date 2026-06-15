/* ============================================================
   VALIDACIÓN DE SALDOS — migración de crédito legacy
   MyBusinessPOS (staging) → sistema principal (credit_balances)
   Dos vistas: Bandeja (lista) + Detalle de cliente.
   ============================================================ */
const Cv = window.CG.color;
const Fv = window.CG.font;
const mnyV  = window.money;       // "$1,500.00"
const mnyVk = window.moneyk;      // "$1.5k"

/* ---- Datos legacy: capa async window.CG.validacion (cg-validacion-data.jsx → /api/validacion).
   list() lee public.v_validacion_saldos / v_validacion_docs (exponen staging.legacy_credit_*);
   validate() llama al RPC validar_saldo_legacy. Sin backend, list() resuelve []. ---- */
function loadLegacy(setRows) {
  if (window.CG && window.CG.validacion && typeof window.CG.validacion.list === "function") {
    window.CG.validacion.list().then(function (list) { setRows(Array.isArray(list) ? list : []); });
  }
}

/* badge por estado de cliente */
function estadoCliente(c) {
  if (c.saldo === 0) return { key:"sinsaldo", tone:"ghost", label:"Sin saldo" };
  if (c.validado)    return { key:"validado", tone:"green", label:"Validado" };
  return { key:"pendiente", tone:"amber", label:"Pendiente" };
}
/* badge por estado de documento */
const DOC_TONE = { "Vencido":"red", "Parcial":"amber", "Aplicado":"blue", "Pagado":"green", "Vigente":"ghost" };

/* ============================================================
   Pantalla principal — controla vista lista / detalle
   ============================================================ */
function ValidacionSaldosScreen({ ai }) {
  const [rows, setRows] = useState([]);
  const [view, setView] = useState("list");      // "list" | "detail"
  const [selId, setSelId] = useState(null);
  const [confirm, setConfirm] = useState(null);   // cliente a confirmar
  const [toast, setToast] = useState(null);       // { tone, msg }
  const sel = rows.find(r=>r.id===selId);

  // Cargar de Supabase al montar (capa async de cg-validacion-data.jsx → /api/validacion).
  useEffect(()=>{ loadLegacy(setRows); }, []);

  const validar = (c) => {
    const hoy = new Date().toISOString().slice(0,10);
    // Optimista: marcamos validado de inmediato; el RPC es la fuente de verdad al recargar.
    setRows(rs => rs.map(r => r.id===c.id
      ? { ...r, validado:true, validadoPor:"Gustavo", validadoAt:hoy, saldoActual:r.saldo }
      : r));
    setConfirm(null);
    setToast({ tone:"green", msg:`Saldo de ${c.nombre} validado y agregado a crédito` });
    setTimeout(()=>setToast(null), 3200);
    // Persistir vía RPC validar_saldo_legacy (crea cuenta + siembra saldo, atómico en BD).
    if (c.customerId && window.CG && window.CG.validacion && window.CG.validacion.validate) {
      window.CG.validacion.validate(c.customerId, "Gustavo").then(function(r){
        if (r && r.ok) loadLegacy(setRows);
        else if (r && r.error) setToast({ tone:"red", msg:`No se pudo validar: ${r.error}` });
      });
    }
  };
  const goDetail = (c) => { setSelId(c.id); setView("detail"); window.scrollTo&&window.scrollTo(0,0); };

  return (
    <div>
      {view==="list"
        ? <BandejaValidacion rows={rows} onOpen={goDetail} onValidar={(c)=>setConfirm(c)} ai={ai} />
        : <DetalleCliente cliente={sel} onBack={()=>setView("list")} onValidar={(c)=>setConfirm(c)} />}

      {/* Modal de confirmación */}
      <Modal open={!!confirm} onClose={()=>setConfirm(null)} icon="shield-check" title="Confirmar validación" width={460}
        footer={<>
          <Btn kind="outline" onClick={()=>setConfirm(null)}>Cancelar</Btn>
          <Btn kind="green" icon="check" onClick={()=>validar(confirm)}>Confirmar y pasar a crédito</Btn>
        </>}>
        {confirm && (
          <div>
            <p style={{ margin:"0 0 16px", font:`400 14px/1.55 ${Fv.ui}`, color:Cv.ink80, textWrap:"pretty" }}>
              Vas a pasar el saldo de <b style={{ color:Cv.ink }}>{confirm.nombre}</b> al sistema de crédito.
              Esta acción crea su cuenta y registra el saldo inicial.
            </p>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
              padding:"14px 16px", borderRadius:11, background:Cv.paper2, border:`1px solid ${Cv.line}` }}>
              <div>
                <div style={{ font:`600 11px/1 ${Fv.ui}`, letterSpacing:"0.04em", textTransform:"uppercase", color:Cv.inkFaint }}>Saldo a promover</div>
                <div style={{ font:`500 11px/1 ${Fv.mono}`, color:Cv.inkFaint, marginTop:6 }}>MBPOS:{confirm.id} · {confirm.ndoc} documentos</div>
              </div>
              <div style={{ font:`700 22px/1 ${Fv.mono}`, color:Cv.red, fontVariantNumeric:"tabular-nums" }}>{mnyV(confirm.saldo)}</div>
            </div>
          </div>
        )}
      </Modal>

      {/* Toast */}
      {toast && (
        <div style={{ position:"fixed", bottom:26, left:"50%", transform:"translateX(-50%)", zIndex:200,
          display:"flex", alignItems:"center", gap:11, padding:"13px 18px", borderRadius:12,
          background:Cv.chrome, color:Cv.chromeFg, boxShadow:"0 16px 40px -12px rgba(0,0,0,0.5)",
          border:`1px solid ${toast.tone==="green"?Cv.green:Cv.red}` }}>
          <Icon name={toast.tone==="green"?"check-circle-2":"alert-circle"} size={20} color={toast.tone==="green"?Cv.green:Cv.red} />
          <span style={{ font:`600 13.5px/1 ${Fv.ui}` }}>{toast.msg}</span>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Vista A — Bandeja (lista densa)
   ============================================================ */
function BandejaValidacion({ rows, onOpen, onValidar, ai }) {
  const [filtro, setFiltro] = useState("Todos");
  const [q, setQ] = useState("");

  const pend = rows.filter(r=>!r.validado && r.saldo>0);
  const val  = rows.filter(r=>r.validado);
  const totalPend = pend.reduce((s,r)=>s+r.saldo,0);
  const totalProm = val.reduce((s,r)=>s+(r.saldoActual||r.saldo),0);

  const visible = rows
    .filter(r => filtro==="Todos"
      || (filtro==="Pendiente" && !r.validado && r.saldo>0)
      || (filtro==="Validado" && r.validado)
      || (filtro==="Sin saldo" && r.saldo===0))
    .filter(r => r.nombre.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a,b)=> b.saldo - a.saldo);

  const th = (align)=>({ textAlign:align, font:`700 11px/1 ${Fv.ui}`, letterSpacing:"0.05em",
    textTransform:"uppercase", color:Cv.inkFaint, padding:"12px 14px", whiteSpace:"nowrap" });
  const td = (align)=>({ textAlign:align, padding:"13px 14px", fontVariantNumeric:"tabular-nums" });

  return (
    <div>
      <ScreenHead title="Validación de saldos — sistema anterior"
        desc="Revisa y aprueba los saldos heredados de MyBusinessPOS antes de pasarlos a crédito."
        right={<Btn kind="outline" icon="arrow-left" onClick={()=>window.__cgGo&&window.__cgGo('cobranza')}>Volver a Cobranza</Btn>} />

      {/* Totales */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:14, marginBottom:18 }}>
        <Card pad={18} style={{ background:Cv.amberWash, borderColor:"transparent" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <Overline color={Cv.amber}>Por validar</Overline><Icon name="clock" size={18} color={Cv.amber} />
          </div>
          <div style={{ font:`400 30px/1 ${Fv.display}`, color:Cv.ink, fontVariantNumeric:"tabular-nums" }}>{mnyV(totalPend)}</div>
          <div style={{ font:`600 12px/1 ${Fv.ui}`, color:Cv.amber, marginTop:8 }}>{pend.length} clientes pendientes</div>
        </Card>
        <Card pad={18} style={{ background:Cv.greenWash, borderColor:"transparent" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <Overline color={Cv.green}>Promovido a crédito</Overline><Icon name="check-circle-2" size={18} color={Cv.green} />
          </div>
          <div style={{ font:`400 30px/1 ${Fv.display}`, color:Cv.ink, fontVariantNumeric:"tabular-nums" }}>{mnyV(totalProm)}</div>
          <div style={{ font:`600 12px/1 ${Fv.ui}`, color:Cv.green, marginTop:8 }}>{val.length} clientes validados</div>
        </Card>
      </div>

      {/* Slot de iAntonella */}
      {ai && <window.Slot id="validacion" ai={ai} />}

      {/* Filtros + búsqueda */}
      <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center", marginBottom:14 }}>
        <div style={{ display:"flex", alignItems:"center", gap:9, border:`1px solid ${Cv.line}`, borderRadius:11,
          padding:"11px 14px", background:Cv.paper, flex:"1 1 240px", minWidth:0 }}>
          <Icon name="search" size={16} color={Cv.inkFaint} />
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar cliente…"
            style={{ flex:1, border:"none", background:"transparent", outline:"none", font:`500 14px/1 ${Fv.ui}`, color:Cv.ink, minWidth:0 }} />
        </div>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {["Pendiente","Validado","Sin saldo","Todos"].map(f=>{
            const on=filtro===f;
            return <button key={f} onClick={()=>setFiltro(f)} style={{ font:`700 12.5px/1 ${Fv.ui}`,
              padding:"10px 13px", borderRadius:9, cursor:"pointer", border:`1px solid ${on?"transparent":Cv.line}`,
              color:on?Cv.chromeFg:Cv.inkSoft, background:on?Cv.chrome:Cv.paper }}>{f}</button>;
          })}
        </div>
      </div>

      {/* Tabla / vacío */}
      {visible.length===0 ? (
        <Card pad={48} style={{ textAlign:"center" }}>
          <Icon name="party-popper" size={40} color={Cv.green} />
          <div style={{ font:`400 19px/1.3 ${Fv.display}`, color:Cv.ink, marginTop:14 }}>No quedan saldos pendientes por validar</div>
          <div style={{ font:`500 13px/1.4 ${Fv.ui}`, color:Cv.inkFaint, marginTop:8 }}>Todos los clientes de esta vista están al día.</div>
        </Card>
      ) : (
        <Card pad={0} style={{ overflow:"hidden" }}>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", minWidth:760 }}>
              <thead><tr style={{ background:Cv.paper2 }}>
                <th style={th("left")}>Cliente</th>
                <th style={th("right")}>Saldo anterior</th>
                <th style={th("center")}>Docs</th>
                <th style={th("right")}>Límite</th>
                <th style={th("center")}>Días</th>
                <th style={th("left")}>Estado</th>
                <th style={th("right")}>Acción</th>
              </tr></thead>
              <tbody>
                {visible.map(c=>{
                  const est = estadoCliente(c);
                  return (
                    <tr key={c.id} style={{ borderTop:`1px solid ${Cv.lineSoft}`, cursor:"pointer", transition:"background .14s" }}
                      onMouseEnter={e=>e.currentTarget.style.background=Cv.paper2}
                      onMouseLeave={e=>e.currentTarget.style.background="transparent"}
                      onClick={()=>onOpen(c)}>
                      <td style={td("left")}>
                        <div style={{ font:`700 13.5px/1.1 ${Fv.ui}`, color:Cv.ink }}>{c.nombre}</div>
                        <div style={{ font:`500 11px/1 ${Fv.mono}`, color:Cv.inkFaint, marginTop:5 }}>MBPOS:{c.id}</div>
                      </td>
                      <td style={{ ...td("right"), font:`700 14px/1 ${Fv.mono}`, color: c.saldo>0?Cv.red:Cv.inkFaint }}>{mnyV(c.saldo)}</td>
                      <td style={{ ...td("center"), font:`500 13px/1 ${Fv.mono}`, color:Cv.ink80 }}>{c.ndoc}</td>
                      <td style={{ ...td("right"), font:`500 13px/1 ${Fv.mono}`, color:Cv.ink80 }}>{mnyVk(c.limite)}</td>
                      <td style={{ ...td("center"), font:`500 13px/1 ${Fv.mono}`, color:Cv.ink80 }}>{c.dias}</td>
                      <td style={td("left")}><Badge tone={est.tone}>{est.label}</Badge></td>
                      <td style={{ ...td("right") }} onClick={e=>e.stopPropagation()}>
                        {c.validado
                          ? <span style={{ display:"inline-flex", alignItems:"center", gap:6, font:`600 12px/1 ${Fv.ui}`, color:Cv.green }}>
                              <Icon name="check" size={15} color={Cv.green} />Validado
                            </span>
                          : c.saldo>0
                            ? <Btn kind="green" size="sm" icon="check" onClick={()=>onValidar(c)}>Validar</Btn>
                            : <span style={{ font:`500 12px/1 ${Fv.ui}`, color:Cv.inkFaint }}>—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ============================================================
   Vista B — Detalle de cliente
   ============================================================ */
function DetalleCliente({ cliente, onBack, onValidar }) {
  if (!cliente) return null;
  const est = estadoCliente(cliente);
  const th = (align)=>({ textAlign:align, font:`700 10.5px/1 ${Fv.ui}`, letterSpacing:"0.05em",
    textTransform:"uppercase", color:Cv.inkFaint, padding:"11px 13px", whiteSpace:"nowrap" });
  const td = (align)=>({ textAlign:align, padding:"12px 13px", fontVariantNumeric:"tabular-nums" });

  return (
    <div>
      {/* Migaja + volver */}
      <button onClick={onBack} style={{ display:"inline-flex", alignItems:"center", gap:7, marginBottom:16,
        font:`600 13px/1 ${Fv.ui}`, color:Cv.inkSoft, background:"transparent", border:"none", cursor:"pointer" }}>
        <Icon name="arrow-left" size={16} color={Cv.inkSoft} /> Bandeja de validación
      </button>

      {/* Cabecera */}
      <Card pad={22} style={{ marginBottom:16 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:18 }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:11, marginBottom:8 }}>
              <h2 style={{ margin:0, font:`400 26px/1.05 ${Fv.display}`, color:Cv.ink }}>{cliente.nombre}</h2>
              <Badge tone={est.tone}>{est.label}</Badge>
            </div>
            <div style={{ font:`500 12px/1 ${Fv.mono}`, color:Cv.inkFaint }}>Referencia legacy · MBPOS:{cliente.id}</div>
            <div style={{ display:"flex", gap:22, marginTop:18 }}>
              <div>
                <div style={{ font:`600 10.5px/1 ${Fv.ui}`, letterSpacing:"0.04em", textTransform:"uppercase", color:Cv.inkFaint }}>Límite de crédito</div>
                <div style={{ font:`600 15px/1 ${Fv.mono}`, color:Cv.ink, marginTop:6 }}>{mnyV(cliente.limite)}</div>
              </div>
              <div>
                <div style={{ font:`600 10.5px/1 ${Fv.ui}`, letterSpacing:"0.04em", textTransform:"uppercase", color:Cv.inkFaint }}>Plazo</div>
                <div style={{ font:`600 15px/1 ${Fv.mono}`, color:Cv.ink, marginTop:6 }}>{cliente.dias} días</div>
              </div>
              <div>
                <div style={{ font:`600 10.5px/1 ${Fv.ui}`, letterSpacing:"0.04em", textTransform:"uppercase", color:Cv.inkFaint }}>Documentos</div>
                <div style={{ font:`600 15px/1 ${Fv.mono}`, color:Cv.ink, marginTop:6 }}>{cliente.ndoc}</div>
              </div>
            </div>
          </div>
          {/* Saldo destacado */}
          <div style={{ textAlign:"right", minWidth:180 }}>
            <div style={{ font:`600 11px/1 ${Fv.ui}`, letterSpacing:"0.04em", textTransform:"uppercase", color:Cv.inkFaint, marginBottom:8 }}>
              {cliente.validado ? "Saldo en crédito" : "Saldo anterior total"}
            </div>
            <div style={{ font:`400 38px/1 ${Fv.display}`, color: cliente.validado?Cv.green:Cv.red, fontVariantNumeric:"tabular-nums" }}>{mnyV(cliente.validado?(cliente.saldoActual||cliente.saldo):cliente.saldo)}</div>
            {cliente.validado && (
              <div style={{ display:"inline-flex", alignItems:"center", gap:7, marginTop:12, padding:"7px 12px",
                borderRadius:8, background:Cv.greenWash, border:`1px solid ${Cv.green}33` }}>
                <Icon name="badge-check" size={15} color={Cv.green} />
                <span style={{ font:`600 11.5px/1 ${Fv.ui}`, color:Cv.green }}>Validado por {cliente.validadoPor} · {cliente.validadoAt}</span>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Tabla de documentos / vacío */}
      {cliente.docs.length===0 ? (
        <Card pad={40} style={{ textAlign:"center" }}>
          <Icon name="file-x" size={34} color={Cv.inkFaint} />
          <div style={{ font:`500 15px/1.3 ${Fv.ui}`, color:Cv.inkSoft, marginTop:12 }}>Sin documentos para este cliente</div>
        </Card>
      ) : (
        <Card pad={0} style={{ overflow:"hidden" }}>
          <div style={{ padding:"15px 18px", borderBottom:`1px solid ${Cv.line}`, font:`700 12px/1 ${Fv.ui}`, letterSpacing:"0.06em", textTransform:"uppercase", color:Cv.inkSoft }}>
            Documentos del sistema anterior
          </div>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", minWidth:780 }}>
              <thead><tr style={{ background:Cv.paper2 }}>
                <th style={th("left")}>Fecha</th><th style={th("left")}>Vence</th>
                <th style={th("left")}>Tipo</th><th style={th("left")}>Referencia</th>
                <th style={th("right")}>Importe</th><th style={th("right")}>Saldo</th>
                <th style={th("left")}>Estado</th><th style={th("left")}>Observación</th>
              </tr></thead>
              <tbody>
                {cliente.docs.map((d,i)=>(
                  <tr key={i} style={{ borderTop:`1px solid ${Cv.lineSoft}` }}>
                    <td style={{ ...td("left"), font:`500 12.5px/1 ${Fv.mono}`, color:Cv.ink80 }}>{d.fecha}</td>
                    <td style={{ ...td("left"), font:`500 12.5px/1 ${Fv.mono}`, color:Cv.ink80 }}>{d.venc}</td>
                    <td style={{ ...td("left"), font:`700 11px/1 ${Fv.ui}`, color:Cv.inkSoft }}>{d.tipo}</td>
                    <td style={{ ...td("left"), font:`500 12.5px/1 ${Fv.mono}`, color:Cv.ink }}>{d.ref}</td>
                    <td style={{ ...td("right"), font:`500 13px/1 ${Fv.mono}`, color: d.importe<0?Cv.green:Cv.ink80 }}>{mnyV(d.importe)}</td>
                    <td style={{ ...td("right"), font:`700 13px/1 ${Fv.mono}`, color: d.saldo<0?Cv.green:(d.saldo>0?Cv.red:Cv.inkFaint) }}>{mnyV(d.saldo)}</td>
                    <td style={td("left")}><Badge tone={DOC_TONE[d.estado]||"ghost"}>{d.estado}</Badge></td>
                    <td style={{ ...td("left"), font:`500 12px/1.3 ${Fv.ui}`, color:Cv.inkFaint, maxWidth:200 }}>{d.obs||"—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Acción primaria (footer al final del contenido) */}
      {!cliente.validado && cliente.saldo>0 && (
        <div style={{ marginTop:18, padding:"16px 20px", borderRadius:13,
          background:Cv.paper, border:`1px solid ${Cv.line}`,
          display:"flex", justifyContent:"space-between", alignItems:"center", gap:16, flexWrap:"wrap" }}>
          <div style={{ font:`500 12.5px/1.45 ${Fv.ui}`, color:Cv.inkSoft, maxWidth:440 }}>
            Al validar, se crea la cuenta de crédito de <b style={{ color:Cv.ink }}>{cliente.nombre}</b> y se registra el saldo inicial de <b style={{ color:Cv.red }}>{mnyV(cliente.saldo)}</b>.
          </div>
          <Btn kind="green" size="lg" icon="shield-check" onClick={()=>onValidar(cliente)}>Validar y pasar al sistema principal</Btn>
        </div>
      )}
    </div>
  );
}

window.ValidacionSaldosScreen = ValidacionSaldosScreen;
