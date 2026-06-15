/* ============================================================
   cg-agente.jsx — Centro "Pendientes y Autorizaciones"
   Consolida tareas pendientes (avisos reales /api/notifications con
   fallback a CG.buildNotifs) + la bitácora de autorizaciones (CG.authLog),
   con un resumen de iAntonella al abrir. Ruta: "pendientes".
   ============================================================ */
const { useState, useEffect } = React;
const Cag = window.CG.color;
const Fag = window.CG.font;

const AG_TONE = { red: Cag.red || "#9E3326", amber: Cag.amber || "#B8860B", blue: Cag.blue || "#2F6FB0", green: Cag.green || "#3C7A4E" };
function agTime(iso) { try { return new Date(iso).toLocaleString("es-MX", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; } }

function AgentePendientesScreen({ ai }) {
  const ScreenHead = window.ScreenHead, Card = window.Card, Btn = window.Btn;
  const [server, setServer] = useState(null);
  const [log, setLog] = useState(window.CG.authLog ? window.CG.authLog() : []);
  const [resumen, setResumen] = useState("");

  useEffect(function () {
    const loadN = function () { if (window.CG.notifications && typeof fetch !== "undefined") window.CG.notifications().then(function (it) { setServer(it || []); }); else setServer([]); };
    const loadL = function () { setLog(window.CG.authLog ? window.CG.authLog() : []); };
    loadN(); loadL();
    window.addEventListener("cg:data", loadN);
    window.addEventListener("cg:authlog", loadL);
    return function () { window.removeEventListener("cg:data", loadN); window.removeEventListener("cg:authlog", loadL); };
  }, []);

  // Resumen narrativo de iAntonella (opcional; si no hay API, queda el resumen calculado).
  useEffect(function () {
    if (window.CG.ask && typeof fetch !== "undefined") window.CG.ask("En 2 frases muy breves, dime lo más urgente que tengo pendiente hoy.", "panel").then(function (t) { if (t) setResumen(t); });
  }, []);

  const pend = (server && server.length)
    ? server.map(function (n) { return { id: n.id, title: n.titulo, text: n.desc, tone: (n.tipo === "alerta" ? "red" : n.tipo === "aviso" ? "amber" : "blue"), go: n.href, ask: "¿Qué hago con: " + (n.titulo || "") + "?" }; })
    : (window.CG.buildNotifs ? window.CG.buildNotifs() : []);
  const resumenCalc = pend.length ? (pend.length + " tarea(s) pendiente(s).") : "Sin pendientes. Todo al día.";

  const limpiarLog = function () { if (window.confirm("¿Borrar la bitácora de autorizaciones?")) { try { localStorage.setItem("cg_authlog", "[]"); } catch (e) {} setLog([]); } };

  return (
    <div>
      <ScreenHead title="Pendientes y Autorizaciones" desc="Tu agente: lo que falta por hacer y el registro de lo que has autorizado con PIN." />
      {/* Resumen de iAntonella */}
      <Card pad={16} style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div style={{ width: 38, height: 38, borderRadius: "50%", background: Cag.redWash || "#fbeae7", display: "grid", placeItems: "center", flexShrink: 0 }}>
            <Icon name="sparkles" size={18} color={Cag.red} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: "700 13px/1.2 " + Fag.ui, color: Cag.ink, marginBottom: 4 }}>iAntonella · resumen del día</div>
            <div style={{ font: "500 13px/1.5 " + Fag.ui, color: Cag.inkSoft, whiteSpace: "pre-wrap" }}>{resumen || resumenCalc}</div>
          </div>
          <Btn kind="outline" size="sm" icon="message-circle" onClick={function () { if (window.__cgAsk) window.__cgAsk("¿Qué tengo pendiente hoy y qué me conviene atender primero?"); }}>Preguntar</Btn>
        </div>
      </Card>

      {/* Tareas pendientes */}
      <Card pad={0} style={{ overflow: "hidden", marginBottom: 14 }}>
        <div style={{ padding: "13px 16px", borderBottom: "1px solid " + Cag.line, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ font: "700 14px/1 " + Fag.ui, color: Cag.ink }}>Tareas pendientes</span>
          <span style={{ font: "700 11px/1 " + Fag.ui, color: "#fff", background: pend.length ? Cag.red : "#bbb", borderRadius: 999, padding: "3px 9px" }}>{pend.length}</span>
        </div>
        {pend.length === 0 ? (
          <div style={{ padding: "24px 16px", textAlign: "center", color: Cag.inkSoft, font: "500 13px/1.4 " + Fag.ui }}>Nada pendiente. 🎉</div>
        ) : pend.map(function (n) {
          const col = AG_TONE[n.tone] || AG_TONE.blue;
          return (
            <div key={n.id} style={{ display: "flex", gap: 11, padding: "12px 16px", borderTop: "1px solid " + (Cag.lineSoft || Cag.line), alignItems: "center" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: col, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: "700 12.5px/1.2 " + Fag.ui, color: Cag.ink }}>{n.title}</div>
                <div style={{ font: "500 11.5px/1.35 " + Fag.ui, color: Cag.inkSoft, marginTop: 2 }}>{n.text}</div>
              </div>
              {n.go && <Btn kind="dark" size="sm" onClick={function () { if (window.__cgGo) window.__cgGo(n.go); }}>Ir</Btn>}
              {n.ask && <Btn kind="outline" size="sm" onClick={function () { if (window.__cgAsk) window.__cgAsk(n.ask); }}>Preguntar</Btn>}
            </div>
          );
        })}
      </Card>

      {/* Bitácora de autorizaciones */}
      <Card pad={0} style={{ overflow: "hidden" }}>
        <div style={{ padding: "13px 16px", borderBottom: "1px solid " + Cag.line, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ font: "700 14px/1 " + Fag.ui, color: Cag.ink }}>Autorizaciones (bitácora)</span>
          {log.length > 0 && <button onClick={limpiarLog} style={{ font: "600 11.5px/1 " + Fag.ui, color: Cag.inkSoft, background: "transparent", border: "none", cursor: "pointer" }}>Limpiar</button>}
        </div>
        {log.length === 0 ? (
          <div style={{ padding: "24px 16px", textAlign: "center", color: Cag.inkSoft, font: "500 13px/1.4 " + Fag.ui }}>Aún no has autorizado acciones sensibles.</div>
        ) : log.map(function (e) {
          return (
            <div key={e.id} style={{ display: "flex", gap: 11, padding: "11px 16px", borderTop: "1px solid " + (Cag.lineSoft || Cag.line), alignItems: "flex-start" }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: Cag.redWash || "#fbeae7", display: "grid", placeItems: "center", flexShrink: 0 }}>
                <Icon name="shield-check" size={15} color={Cag.red} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: "600 12.5px/1.35 " + Fag.ui, color: Cag.ink, wordBreak: "break-word" }}>{e.action}</div>
                <div style={{ font: "500 11px/1.3 " + Fag.ui, color: Cag.inkSoft, marginTop: 3 }}>{e.screen ? e.screen + " · " : ""}{agTime(e.ts)}</div>
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}

window.AgentePendientesScreen = AgentePendientesScreen;
