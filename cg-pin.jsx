/* ============================================================
   cg-pin.jsx — Seguridad: PINs configurables + compuerta de PIN
   - CG.getPin/setPin/checkPin(kind) con kinds: privacy | cedis | frio
   - CG.requirePin(kind, onOk): muestra una compuerta de PIN (PinGate)
   - PinPad: teclado reutilizable · SeguridadScreen: módulo de Configuración
   No reescribe pantallas: es infraestructura de seguridad (cliente).
   ============================================================ */
const Cp = window.CG.color;
const Fp = window.CG.font;

// --- almacén de PINs (localStorage; por dispositivo) ---
window.CG.getPin = function (kind) {
  try { return localStorage.getItem("cg_pin_" + kind) || "0000"; } catch (e) { return "0000"; }
};
window.CG.setPin = function (kind, val) {
  try { localStorage.setItem("cg_pin_" + kind, String(val)); } catch (e) {}
};
window.CG.checkPin = function (kind, val) { return String(val) === window.CG.getPin(kind); };
// solicita un PIN; al acertar ejecuta onOk()
window.CG.requirePin = function (kind, onOk, opts) {
  window.CG._pinReq = { kind: kind, onOk: onOk, opts: opts || {} };
  window.dispatchEvent(new Event("cg:pin"));
};
// Bitácora de autorizaciones (auditoría local de acciones sensibles aprobadas).
window.CG.authLog = function () { try { return JSON.parse(localStorage.getItem("cg_authlog") || "[]"); } catch (e) { return []; } };
window.CG.logAuth = function (action) {
  try {
    var scr = window.__cgScreen || "";
    if (window.CG.labelOf && scr) scr = window.CG.labelOf(scr) || scr;
    var l = window.CG.authLog();
    l.unshift({ id: "a" + Date.now(), action: action || "Acción autorizada", screen: scr, ts: new Date().toISOString() });
    localStorage.setItem("cg_authlog", JSON.stringify(l.slice(0, 200)));
    window.dispatchEvent(new Event("cg:authlog"));
  } catch (e) {}
};

// Autoriza una acción sensible / no reversible con el PIN de privacidad (= PIN de autorización).
// Uso: CG.requireAuth(() => { ...acción... }, "¿Eliminar el pedido #123?")
window.CG.requireAuth = function (onOk, msg) {
  var wrapped = function () { window.CG.logAuth(msg); if (onOk) onOk(); };
  if (window.CG.requirePin) window.CG.requirePin("privacy", wrapped, { msg: msg || "Confirma con tu PIN para autorizar esta acción", auth: true });
  else wrapped();
};

const PIN_LABEL = { privacy: "PIN de privacidad", cedis: "Código de verificación CEDIS", frio: "Código del área de Frío" };

// Teclado de PIN reutilizable. onSubmit(pin) → true (ok, limpia) | false (error, sacude).
function PinPad({ onSubmit, tone }) {
  const accent = tone || Cp.cream || "#F1E7D6";
  const [pin, setPin] = useState("");
  const [err, setErr] = useState(false);
  const tap = (k) => {
    setErr(false);
    if (k === "←") { setPin(p => p.slice(0, -1)); return; }
    const next = (pin + k).slice(0, 4);
    setPin(next);
    if (next.length === 4) setTimeout(() => {
      const okk = onSubmit && onSubmit(next);
      if (okk) setPin(""); else { setErr(true); setPin(""); }
    }, 110);
  };
  useEffect(() => {
    const onKey = (e) => { if (/^[0-9]$/.test(e.key)) tap(e.key); else if (e.key === "Backspace") tap("←"); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  return (
    <React.Fragment>
      <div className={err ? "cg-shake" : ""} style={{ display:"flex", gap:14, justifyContent:"center" }}>
        {[0,1,2,3].map(i => (
          <span key={i} style={{ width:14, height:14, borderRadius:"50%",
            background: i<pin.length ? (err?Cp.red:accent) : "transparent",
            border:`2px solid ${err?Cp.red:"rgba(120,110,98,0.45)"}`, transition:"background .15s" }} />
        ))}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 64px)", gap:12, justifyContent:"center" }}>
        {["1","2","3","4","5","6","7","8","9","","0","←"].map((k,i)=> k==="" ?
          <span key={i} /> :
          <button key={i} onClick={()=>tap(k)} className="cg-lock-key" style={{ height:64, borderRadius:"50%",
            border:`1px solid rgba(120,110,98,0.25)`, background:"rgba(120,110,98,0.07)", color:Cp.ink||"#2A211A",
            font:`400 23px/1 ${k==="←"?Fp.ui:(Fp.display||Fp.ui)}`, cursor:"pointer", display:"grid", placeItems:"center" }}>
            {k==="←" ? "⌫" : k}
          </button>
        )}
      </div>
    </React.Fragment>
  );
}

// Compuerta modal: aparece cuando alguien llama CG.requirePin(kind, onOk).
function PinGate() {
  const [req, setReq] = useState(null);
  useEffect(() => {
    const h = () => setReq(window.CG._pinReq || null);
    window.addEventListener("cg:pin", h);
    return () => window.removeEventListener("cg:pin", h);
  }, []);
  if (!req) return null;
  const close = () => { setReq(null); window.CG._pinReq = null; };
  return (
    <div onClick={close} style={{ position:"fixed", inset:0, zIndex:400, display:"flex", alignItems:"center",
      justifyContent:"center", padding:20, background:"rgba(20,16,12,0.55)", backdropFilter:"blur(3px)" }}>
      <div onClick={e=>e.stopPropagation()} style={{ width:"min(340px,94vw)", background:Cp.paper||"#fff",
        borderRadius:18, border:`1px solid ${Cp.line||"#0001"}`, padding:"22px 20px", display:"flex",
        flexDirection:"column", gap:16, boxShadow:"0 30px 80px -30px rgba(0,0,0,0.5)" }}>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:26, marginBottom:2 }}>{req.opts.auth ? "🛡️" : "🔒"}</div>
          <div style={{ font:`700 15px/1.2 ${Fp.ui}`, color:Cp.ink }}>{req.opts.auth ? "Autorización requerida" : (PIN_LABEL[req.kind] || "Ingresa el PIN")}</div>
          <div style={{ font:`500 12px/1.3 ${Fp.ui}`, color:Cp.inkSoft, marginTop:5 }}>{req.opts.msg || "Ingresa tu PIN de 4 dígitos"}</div>
        </div>
        <PinPad tone={Cp.red} onSubmit={(v)=>{
          if (window.CG.checkPin(req.kind, v)) { const ok=req.onOk; close(); if(ok) ok(); return true; }
          return false;
        }} />
        <button onClick={close} style={{ font:`600 13px/1 ${Fp.ui}`, color:Cp.inkSoft, background:"transparent",
          border:"none", cursor:"pointer", padding:"4px" }}>Cancelar</button>
      </div>
    </div>
  );
}

// Módulo de Configuración: establecer los PINs (privacidad, CEDIS, Frío).
function SeguridadScreen({ ai }) {
  const ScreenHead = window.ScreenHead, Card = window.Card, Icon = window.Icon, Btn = window.Btn;
  const kinds = [
    { kind:"privacy", icon:"shield", title:"PIN de privacidad", desc:"Bloquea la app y revela los montos del panel." },
    { kind:"cedis", icon:"scale", title:"Código CEDIS", desc:"Acceso a la captura de pesos de canales (verificación)." },
    { kind:"frio", icon:"snowflake", title:"Código de Frío", desc:"Acceso al área de inventario en frío." },
  ];
  const [vals, setVals] = useState(()=> ({ privacy:"", cedis:"", frio:"" }));
  const [saved, setSaved] = useState("");
  const guardar = (kind)=>{
    const v = (vals[kind]||"").trim();
    if(!/^\d{4}$/.test(v)){ window.alert("El PIN debe ser de 4 dígitos."); return; }
    window.CG.setPin(kind, v);
    setVals(s=>({ ...s, [kind]:"" })); setSaved(kind); setTimeout(()=>setSaved(""), 2000);
  };
  return (
    <div>
      <ScreenHead title="Seguridad y PINs" desc="Define los códigos de 4 dígitos. Se guardan en este dispositivo. El de privacidad bloquea la app y descubre los montos." />
      {ai && window.Slot ? <window.Slot id="caja" ai={ai} /> : null}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))", gap:13 }}>
        {kinds.map(k=>(
          <Card key={k.kind} pad={18}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
              <div style={{ width:42, height:42, borderRadius:11, background:Cp.redWash||"#fdecea", display:"grid", placeItems:"center", flexShrink:0 }}>
                <Icon name={k.icon} size={20} color={Cp.red} />
              </div>
              <div>
                <div style={{ font:`700 14.5px/1.1 ${Fp.ui}`, color:Cp.ink }}>{k.title}</div>
                <div style={{ font:`500 11.5px/1.35 ${Fp.ui}`, color:Cp.inkSoft, marginTop:3 }}>{k.desc}</div>
              </div>
            </div>
            <div style={{ display:"flex", gap:9, alignItems:"center", marginTop:6 }}>
              <input type="password" inputMode="numeric" maxLength={4} placeholder="Nuevo PIN (4 díg.)"
                value={vals[k.kind]} onChange={e=>setVals(s=>({ ...s, [k.kind]:e.target.value.replace(/\D/g,"").slice(0,4) }))}
                style={{ flex:1, font:`600 15px/1 ${Fp.mono}`, letterSpacing:"0.3em", padding:"11px 12px", borderRadius:10,
                  border:`1px solid ${Cp.line}`, background:Cp.paper2||Cp.paper, outline:"none", color:Cp.ink, minWidth:0 }} />
              <Btn kind="dark" size="sm" icon={saved===k.kind?"check":"save"} onClick={()=>guardar(k.kind)}>
                {saved===k.kind ? "Guardado" : "Guardar"}
              </Btn>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

window.PinPad = PinPad;
window.PinGate = PinGate;
window.SeguridadScreen = SeguridadScreen;
