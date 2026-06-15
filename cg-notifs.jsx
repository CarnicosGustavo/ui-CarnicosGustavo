/* ============================================================
   cg-notifs.jsx — Centro de notificaciones in-app (campana)
   Deriva avisos del estado REAL (CG.ops): pesajes pendientes, pedidos
   listos para cobro, saldos vencidos y faltantes. Cada aviso navega a
   su pantalla o se lo pregunta a iAntonella. Estado "leído" en localStorage.
   ============================================================ */
const { useState, useEffect } = React;
const Cnf = window.CG.color;
const Fnf = window.CG.font;
const mk = (n) => (window.moneyk ? window.moneyk(n) : "$" + n);

// Deriva la lista de avisos del estado actual del sistema.
window.CG.buildNotifs = function () {
  const O = window.CG.ops || {};
  const out = [];
  const peds = O.pedidos || [];
  peds.forEach(function (p) {
    if (/pesar|pesaje/i.test(p.estado || "")) out.push({ id: "pesaje-" + p.id, tone: "amber", icon: "scale",
      title: "Pedido por pesar", text: "#" + p.id + " · " + (p.cliente || "") + " — " + (p.items || 0) + " art.", go: "bascula", ask: "¿Qué falta pesar del pedido #" + p.id + "?" });
  });
  peds.forEach(function (p) {
    if (/lista para cobro/i.test(p.estado || "")) out.push({ id: "cobro-" + p.id, tone: "blue", icon: "hand-coins",
      title: "Listo para cobro", text: "#" + p.id + " · " + (p.cliente || ""), go: "cobro", ask: "¿Cómo cobro el pedido #" + p.id + "?" });
  });
  (O.cobranza || []).forEach(function (c) {
    if ((c.dias || 0) > 0 && (c.saldo || 0) > 0) out.push({ id: "saldo-" + String(c.cliente || "").replace(/\s/g, ""), tone: "red", icon: "alert-triangle",
      title: "Saldo vencido", text: (c.cliente || "") + " — " + mk(c.saldo) + " · " + c.dias + " días", go: "cobranza", ask: "¿Cómo cobro a " + c.cliente + "?" });
  });
  (((O.pos || {}).catalogo) || []).forEach(function (it) {
    if (it.disp === "faltante") out.push({ id: "falta-" + it.n, tone: "red", icon: "package-x",
      title: "Producto faltante", text: it.n + " — sin stock", go: "despiece", ask: "¿Cómo cubro el faltante de " + it.n + "?" });
  });
  return out;
};

window.CG.notifSeen = function () { try { return JSON.parse(localStorage.getItem("cg_notif_seen") || "[]"); } catch (e) { return []; } };
window.CG.markNotifsSeen = function (ids) {
  try { const s = window.CG.notifSeen(); ids.forEach(function (i) { if (s.indexOf(i) < 0) s.push(i); }); localStorage.setItem("cg_notif_seen", JSON.stringify(s)); } catch (e) {}
};

const NOTIF_TONE = {
  red:   { dot: Cnf.red || "#9E3326", wash: Cnf.redWash || "#fbeae7" },
  amber: { dot: Cnf.amber || "#B8860B", wash: Cnf.amberWash || "#fdf3e0" },
  blue:  { dot: Cnf.blue || "#2F6FB0", wash: "#eaf1f8" },
  green: { dot: Cnf.green || "#3C7A4E", wash: "#e9f3ec" },
};

// Campana del header con badge de no leídas + panel desplegable.
function NotifBell() {
  const [open, setOpen] = useState(false);
  const [, bump] = useState(0);
  const [seen, setSeen] = useState(window.CG.notifSeen());
  useEffect(function () {
    const h = function () { bump(function (x) { return x + 1; }); };
    window.addEventListener("cg:data", h);
    window.addEventListener("cg:notif", h);
    return function () { window.removeEventListener("cg:data", h); window.removeEventListener("cg:notif", h); };
  }, []);
  const notifs = window.CG.buildNotifs();
  const unread = notifs.filter(function (n) { return seen.indexOf(n.id) < 0; });
  // Sincroniza el punto rojo de Ramón con avisos sin leer.
  useEffect(function () { if (window.CG.ramon && window.CG.ramon.setAlert) window.CG.ramon.setAlert(unread.length > 0); });

  const marcarTodo = function () { const ids = notifs.map(function (n) { return n.id; }); window.CG.markNotifsSeen(ids); setSeen(window.CG.notifSeen()); };
  const onItem = function (n) { window.CG.markNotifsSeen([n.id]); setSeen(window.CG.notifSeen()); };

  return (
    <div style={{ position: "relative" }}>
      <button title="Notificaciones" onClick={function () { setOpen(function (o) { return !o; }); }}
        style={{ width: 38, height: 38, borderRadius: "50%", border: "1px solid " + Cnf.line, background: Cnf.paper2 || Cnf.paper,
          display: "grid", placeItems: "center", cursor: "pointer", position: "relative" }}>
        <Icon name="bell" size={18} color={Cnf.inkSoft} />
        {unread.length > 0 && (
          <span style={{ position: "absolute", top: -3, right: -3, minWidth: 17, height: 17, padding: "0 4px", borderRadius: 9,
            background: Cnf.red, color: "#fff", font: "700 10px/17px " + Fnf.ui, textAlign: "center", boxShadow: "0 0 0 2px " + Cnf.paper }}>
            {unread.length > 9 ? "9+" : unread.length}
          </span>
        )}
      </button>
      {open && (
        <>
          <div onClick={function () { setOpen(false); }} style={{ position: "fixed", inset: 0, zIndex: 90 }} />
          <div style={{ position: "absolute", top: 46, right: 0, width: "min(360px, 92vw)", maxHeight: 460, overflowY: "auto",
            background: Cnf.paper, border: "1px solid " + Cnf.line, borderRadius: 14, boxShadow: "0 24px 60px -24px rgba(0,0,0,0.4)", zIndex: 91 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderBottom: "1px solid " + Cnf.line, position: "sticky", top: 0, background: Cnf.paper }}>
              <span style={{ font: "700 14px/1 " + Fnf.ui, color: Cnf.ink }}>Notificaciones</span>
              {notifs.length > 0 && <button onClick={marcarTodo} style={{ font: "600 11.5px/1 " + Fnf.ui, color: Cnf.red, background: "transparent", border: "none", cursor: "pointer" }}>Marcar leídas</button>}
            </div>
            {notifs.length === 0 ? (
              <div style={{ padding: "28px 16px", textAlign: "center", color: Cnf.inkFaint || Cnf.inkSoft, font: "500 13px/1.4 " + Fnf.ui }}>
                <div style={{ fontSize: 26, marginBottom: 6 }}>✓</div>Todo al día. Sin avisos.
              </div>
            ) : notifs.map(function (n) {
              const t = NOTIF_TONE[n.tone] || NOTIF_TONE.blue;
              const isUnread = seen.indexOf(n.id) < 0;
              return (
                <div key={n.id} style={{ display: "flex", gap: 11, padding: "12px 14px", borderBottom: "1px solid " + (Cnf.lineSoft || Cnf.line),
                  background: isUnread ? t.wash : "transparent" }}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: t.wash, display: "grid", placeItems: "center", flexShrink: 0 }}>
                    <Icon name={n.icon} size={17} color={t.dot} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: "700 12.5px/1.2 " + Fnf.ui, color: Cnf.ink }}>{n.title}</div>
                    <div style={{ font: "500 11.5px/1.35 " + Fnf.ui, color: Cnf.inkSoft, marginTop: 2, wordBreak: "break-word" }}>{n.text}</div>
                    <div style={{ display: "flex", gap: 8, marginTop: 7 }}>
                      {n.go && <button onClick={function () { onItem(n); setOpen(false); if (window.__cgGo) window.__cgGo(n.go); }}
                        style={{ font: "700 11px/1 " + Fnf.ui, color: "#fff", background: Cnf.ink, border: "none", borderRadius: 7, padding: "5px 10px", cursor: "pointer" }}>Ir</button>}
                      {n.ask && <button onClick={function () { onItem(n); setOpen(false); if (window.__cgAsk) window.__cgAsk(n.ask); }}
                        style={{ font: "700 11px/1 " + Fnf.ui, color: Cnf.red, background: "transparent", border: "1px solid " + Cnf.line, borderRadius: 7, padding: "5px 10px", cursor: "pointer" }}>Preguntar a Antonella</button>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

window.NotifBell = NotifBell;
