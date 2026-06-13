# UI Cárnicos Gustavo — Prototipo de diseño (Claude Design)

Diseño navegable **original** del panel de gestión de Cárnicos Gustavo
(versión más reciente: incluye `cg-cold`, `cg-flows`, `cg-screens-prof`,
`cg-secure-dashboard`). Es la **fuente de verdad del diseño**, sin editar.

Estático: React + Babel desde CDN, sin build. Entrada: `index.html`.

## Cómo verlo
- **Local:** `npx serve .` y abre la URL (no sirve con `file://` por CORS de Babel).
- **Vercel:** framework "Other", sin build.

## Nota
La conexión a datos reales se implementa en la **app Next.js** (repo
M1-Gestion-CarnicosGustavo), que ya tiene auth + Supabase seguro. Este repo
es la referencia visual fiel para esa implementación.
