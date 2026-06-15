/* ============================================================
   cg-feedback.jsx — Herramienta de feedback in-browser (estilo Vercel Toolbar)
   - Modo "comentar": clic en cualquier punto deja un pin con nota + tipo
     (Bug / Idea / Usabilidad / Nota) y captura el elemento señalado y la pantalla.
   - Panel con la lista de comentarios; exporta un INFORME (Markdown) para pasarlo.
   - Persiste en localStorage (sobrevive recargas mientras pruebas).
   No toca el diseño de las pantallas: es una capa de QA montada en App.
   ============================================================ */
const { useState, useEffect } = React;
const Cfb = window.CG.color;
const Ffb = window.CG.font;

const FB_KINDS = {
  bug:       { emoji: "🐞", label: "Bug",        color: "#C0271C" },
  idea:      { emoji: "💡", label: "Idea",       color: "#B8860B" },
  usability: { emoji: "👆", label: "Usabilidad", color: "#2F6FB0" },
  note:      { emoji: "📝", label: "Nota",       color: "#3C7A4E" },
};

window.CG.fbGet = function () { try { return JSON.parse(localStorage.getItem("cg_feedback") || "[]"); } catch (e) { return []; } };
window.CG.fbSet = function (arr) { try { localStorage.setItem("cg_feedback", JSON.stringify(arr)); } catch (e) {} };

// Describe el elemento señalado (para que el informe sea accionable).
function describeEl(el) {
  if (!el || el === document.body) return "—";
  var tag = (el.tagName || "").toLowerCase();
  var label = el.getAttribute && (el.getAttribute("aria-label") || el.getAttribute("title") || el.getAttribute("placeholder"));
  var txt = (el.innerText || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 48);
  return tag + (label ? ` "${label}"` : (txt ? ` "${txt}"` : ""));
}
function screenLabel() {
  var id = window.__cgScreen || "panel";
  return (window.CG.labelOf && window.CG.labelOf(id)) || id;
}

function FeedbackTool() {
  const [open, setOpen] = useState(false);       // panel de lista abierto
  const [placing, setPlacing] = useState(false);  // modo "comentar" (clic para fijar)
  const [draft, setDraft] = useState(null);        // { x, y, el, screen }
  const [kind, setKind] = useState("usability");
  const [text, setText] = useState("");
  const [items, setItems] = useState(window.CG.fbGet());
  const [copied, setCopied] = useState(false);
  const save = (arr) => { setItems(arr); window.CG.fbSet(arr); };

  useEffect(function () {
    const onKey = (e) => { if (e.key === "Escape") { setPlacing(false); setDraft(null); } };
    window.addEventListener("keydown", onKey);
    return function () { window.removeEventListener("keydown", onKey); };
  }, []);

  // Captura el punto + elemento señalado al hacer clic en modo "comentar".
  const onCapture = (e) => {
    e.preventDefault(); e.stopPropagation();
    const x = e.clientX, y = e.clientY, ov = e.currentTarget;
    ov.style.pointerEvents = "none";
    const el = document.elementFromPoint(x, y);
    ov.style.pointerEvents = "auto";
    setDraft({ x, y, el: describeEl(el), screen: screenLabel() });
    setText(""); setPlacing(false);
  };
  const commit = () => {
    if (!text.trim() || !draft) { setDraft(null); return; }
    const it = { id: "fb" + Date.now(), kind, text: text.trim(), el: draft.el,
      screen: draft.screen, x: draft.x, y: draft.y, ts: new Date().toISOString() };
    save([it].concat(items)); setDraft(null); setText("");
  };
  const del = (id) => save(items.filter(function (i) { return i.id !== id; }));
  const clearAll = () => { if (window.confirm("¿Borrar todos los comentarios de feedback?")) save([]); };

  // Construye el informe en Markdown y lo copia + descarga.
  const exportar = () => {
    if (!items.length) return;
    const byScreen = {};
    items.slice().reverse().forEach(function (i) { (byScreen[i.screen] = byScreen[i.screen] || []).push(i); });
    var md = "# Informe de feedback — Cárnicos Gustavo UI\n\n";
    md += "Generado: " + new Date().toLocaleString("es-MX") + " · " + items.length + " comentarios · " + (location.host || "") + "\n\n";
    Object.keys(byScreen).forEach(function (scr) {
      md += "## " + scr + "\n\n";
      byScreen[scr].forEach(function (i, n) {
        var k = FB_KINDS[i.kind] || FB_KINDS.note;
        md += (n + 1) + ". **[" + k.label + "]** " + i.text + "\n";
        md += "   - Elemento: `" + i.el + "` · pos (" + i.x + "," + i.y + ") · " + new Date(i.ts).toLocaleTimeString("es-MX") + "\n";
      });
      md += "\n";
    });
    md += "---\n<!-- datos crudos para reimportar -->\n```json\n" + JSON.stringify(items, null, 2) + "\n```\n";
    try { if (navigator.clipboard) navigator.clipboard.writeText(md); } catch (e) {}
    try {
      var blob = new Blob([md], { type: "text/markdown" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = "feedback-cg-" + new Date().toISOString().slice(0, 10) + ".md";
      document.body.appendChild(a); a.click(); a.remove();
    } catch (e) {}
    setCopied(true); setTimeout(function () { setCopied(false); }, 2200);
  };

  // Pins de la pantalla actual (coordenadas de viewport).
  const curScreen = screenLabel();
  const pins = items.filter(function (i) { return i.screen === curScreen; });

  return (
    <>
      {/* overlay de captura (modo comentar) */}
      {placing && (
        <div onClick={onCapture} title="Haz clic en el punto a comentar"
          style={{ position: "fixed", inset: 0, zIndex: 500, cursor: "crosshair", background: "rgba(192,39,28,0.06)" }}>
          <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", background: Cfb.ink,
            color: "#fff", font: "700 12px/1 " + Ffb.ui, padding: "9px 14px", borderRadius: 999, boxShadow: "0 8px 24px -8px rgba(0,0,0,.5)" }}>
            Haz clic en lo que quieras comentar · Esc para salir
          </div>
        </div>
      )}

      {/* pins de comentarios en la pantalla actual */}
      {!placing && pins.map(function (i) {
        var k = FB_KINDS[i.kind] || FB_KINDS.note;
        return (
          <div key={i.id} title={k.label + ": " + i.text}
            style={{ position: "fixed", left: i.x, top: i.y, transform: "translate(-50%,-50%)", zIndex: 70,
              width: 22, height: 22, borderRadius: "50%", background: k.color, color: "#fff", font: "700 11px/22px " + Ffb.ui,
              textAlign: "center", border: "2px solid #fff", boxShadow: "0 3px 10px -2px rgba(0,0,0,.5)", pointerEvents: "none" }}>
            {k.emoji.slice(0, 2)}
          </div>
        );
      })}

      {/* editor de nota tras señalar un punto */}
      {draft && (
        <div onClick={function () { setDraft(null); }} style={{ position: "fixed", inset: 0, zIndex: 510, background: "rgba(20,16,12,.4)" }}>
          <div onClick={function (e) { e.stopPropagation(); }} style={{ position: "absolute",
            left: Math.min(Math.max(draft.x, 170), (window.innerWidth || 360) - 170), top: Math.min(draft.y + 14, (window.innerHeight || 600) - 240),
            transform: "translateX(-50%)", width: "min(320px,92vw)", background: Cfb.paper, border: "1px solid " + Cfb.line,
            borderRadius: 14, padding: 14, boxShadow: "0 24px 60px -24px rgba(0,0,0,.5)" }}>
            <div style={{ font: "600 11px/1.3 " + Ffb.ui, color: Cfb.inkSoft, marginBottom: 8 }}>{curScreen} · <code>{draft.el}</code></div>
            <div style={{ display: "flex", gap: 6, marginBottom: 9 }}>
              {Object.keys(FB_KINDS).map(function (k) {
                var on = kind === k, d = FB_KINDS[k];
                return <button key={k} onClick={function () { setKind(k); }}
                  style={{ flex: 1, font: "700 11px/1 " + Ffb.ui, padding: "7px 4px", borderRadius: 8, cursor: "pointer",
                    border: "1px solid " + (on ? d.color : Cfb.line), background: on ? d.color : "transparent", color: on ? "#fff" : Cfb.ink }}>
                  {d.emoji} {d.label}
                </button>;
              })}
            </div>
            <textarea autoFocus value={text} onChange={function (e) { setText(e.target.value); }} placeholder="Describe el problema o la idea…"
              rows={3} style={{ width: "100%", font: "500 13px/1.4 " + Ffb.ui, padding: "9px 10px", borderRadius: 9,
                border: "1px solid " + Cfb.line, resize: "vertical", outline: "none", color: Cfb.ink, background: Cfb.paper2 || Cfb.paper }} />
            <div style={{ display: "flex", gap: 8, marginTop: 9, justifyContent: "flex-end" }}>
              <button onClick={function () { setDraft(null); }} style={{ font: "700 12px/1 " + Ffb.ui, color: Cfb.inkSoft, background: "transparent", border: "none", cursor: "pointer", padding: "8px 10px" }}>Cancelar</button>
              <button onClick={commit} style={{ font: "700 12px/1 " + Ffb.ui, color: "#fff", background: Cfb.ink, border: "none", borderRadius: 9, padding: "8px 14px", cursor: "pointer" }}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* panel de lista */}
      {open && (
        <>
          <div onClick={function () { setOpen(false); }} style={{ position: "fixed", inset: 0, zIndex: 95 }} />
          <div style={{ position: "fixed", left: 18, bottom: 74, width: "min(360px,92vw)", maxHeight: "70vh", overflowY: "auto",
            background: Cfb.paper, border: "1px solid " + Cfb.line, borderRadius: 16, boxShadow: "0 24px 60px -24px rgba(0,0,0,.5)", zIndex: 96 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 15px", borderBottom: "1px solid " + Cfb.line, position: "sticky", top: 0, background: Cfb.paper }}>
              <span style={{ font: "700 14px/1 " + Ffb.ui, color: Cfb.ink }}>Feedback · {items.length}</span>
              <div style={{ display: "flex", gap: 8 }}>
                {items.length > 0 && <button onClick={clearAll} style={{ font: "600 11.5px/1 " + Ffb.ui, color: Cfb.inkSoft, background: "transparent", border: "none", cursor: "pointer" }}>Limpiar</button>}
                <button onClick={exportar} disabled={!items.length} style={{ font: "700 11.5px/1 " + Ffb.ui, color: "#fff", background: items.length ? Cfb.red : "#bbb", border: "none", borderRadius: 8, padding: "6px 11px", cursor: items.length ? "pointer" : "default" }}>{copied ? "✓ Copiado" : "Exportar"}</button>
              </div>
            </div>
            {items.length === 0 ? (
              <div style={{ padding: "26px 16px", textAlign: "center", color: Cfb.inkSoft, font: "500 13px/1.5 " + Ffb.ui }}>
                Pulsa <b>Comentar</b> y haz clic en lo que quieras señalar. Al terminar, <b>Exporta</b> el informe.
              </div>
            ) : items.map(function (i) {
              var k = FB_KINDS[i.kind] || FB_KINDS.note;
              return (
                <div key={i.id} style={{ display: "flex", gap: 10, padding: "11px 15px", borderBottom: "1px solid " + (Cfb.lineSoft || Cfb.line) }}>
                  <span style={{ flexShrink: 0, fontSize: 16 }}>{k.emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: "600 12.5px/1.35 " + Ffb.ui, color: Cfb.ink, wordBreak: "break-word" }}>{i.text}</div>
                    <div style={{ font: "500 11px/1.3 " + Ffb.ui, color: Cfb.inkSoft, marginTop: 3 }}>{i.screen} · <code>{i.el}</code></div>
                  </div>
                  <button onClick={function () { del(i.id); }} title="Borrar" style={{ flexShrink: 0, background: "transparent", border: "none", cursor: "pointer", color: Cfb.inkSoft, padding: 2 }}>
                    <Icon name="trash-2" size={15} color={Cfb.inkSoft} />
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* launcher flotante (abajo-izquierda; el dock de Antonella está abajo-derecha) */}
      <div style={{ position: "fixed", left: 18, bottom: 18, zIndex: 80, display: "flex", gap: 8, alignItems: "center" }}>
        <button onClick={function () { setPlacing(function (p) { return !p; }); setOpen(false); }}
          title="Comentar (señalar en pantalla)"
          style={{ height: 44, borderRadius: 999, padding: "0 16px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7,
            border: "1px solid " + Cfb.line, background: placing ? Cfb.red : Cfb.ink, color: "#fff",
            font: "700 13px/1 " + Ffb.ui, boxShadow: "0 10px 28px -10px rgba(0,0,0,.5)" }}>
          <Icon name={placing ? "x" : "message-square-plus"} size={17} color="#fff" />
          {placing ? "Cancelar" : "Comentar"}
        </button>
        <button onClick={function () { setOpen(function (o) { return !o; }); setPlacing(false); }}
          title="Ver feedback / exportar"
          style={{ width: 44, height: 44, borderRadius: "50%", cursor: "pointer", display: "grid", placeItems: "center",
            border: "1px solid " + Cfb.line, background: Cfb.paper, position: "relative", boxShadow: "0 10px 28px -12px rgba(0,0,0,.4)" }}>
          <Icon name="list" size={18} color={Cfb.ink} />
          {items.length > 0 && <span style={{ position: "absolute", top: -3, right: -3, minWidth: 18, height: 18, padding: "0 4px",
            borderRadius: 9, background: Cfb.red, color: "#fff", font: "700 10px/18px " + Ffb.ui, textAlign: "center", boxShadow: "0 0 0 2px " + Cfb.paper }}>{items.length}</span>}
        </button>
      </div>
    </>
  );
}

// Esc sale del modo comentar (se engancha en el propio componente vía efecto global).
window.FeedbackTool = FeedbackTool;
