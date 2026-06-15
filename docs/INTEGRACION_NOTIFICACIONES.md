# Notificaciones (avisos de iAntonella) — coordinación con Claude Code

**Hecho (rama `feat/notificaciones`):**
- `api/notifications.js` — avisos reales desde Supabase (service-role): cobranza pendiente, pedidos por pesar, pedidos por cobrar, despiece sugerido. Forma: `{ count, items:[{ id, tipo:"alerta|aviso|info", titulo, desc, href, time }] }`. `href` = id de módulo (`cobranza|bascula|cobro|despiece`) para `window.__cgGo(href)`.
- `cg-notif.jsx` — `window.CG.notifications()` → Promise de items (fallback `[]`). Cableado en build + index.html.

**Para Claude Code (cableado visual, evita que dos manos toquen estos archivos):**
1. En `NotificationCenter` (`cg-config-antonella.jsx`): reemplazar el `useState` con mock por una carga real en `useEffect`:
   ```js
   const [notifs,setNotifs]=useState([]);
   useEffect(()=>{ if(window.CG&&CG.notifications) CG.notifications().then(setNotifs); },[]);
   ```
   Mantener `read` en estado local (markAsRead) y, al hacer clic, `window.__cgGo && window.__cgGo(n.href)`.
2. Badge de no-leídos en la campana del TopBar: `CG.notifications().then(a=>setCount(a.length))`.
3. **Slots por módulo (AntonellaSlot):** `CG.antonella` sigue siendo mock; si se quiere real por módulo, se puede derivar de `CG.notifications()` filtrando por `href===moduleId`.

**Notas:** el endpoint es de solo lectura y no rompe nada si falta `SUPABASE_SERVICE_ROLE_KEY` (devuelve items vacíos). Reutiliza las mismas convenciones que `api/cg-data.js`.
