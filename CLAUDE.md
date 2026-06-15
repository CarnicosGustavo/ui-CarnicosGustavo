# CLAUDE.md — ui-CarnicosGustavo (PROYECTO 2 de 2: la UI nueva)

> Lee esto primero. Identifica plenamente este proyecto y su relación con el otro.

## 🪪 Identidad
- **Nombre:** `ui-CarnicosGustavo` — **la nueva interfaz** (UI final) de Cárnicos Gustavo.
- **Qué es:** el **frontend nuevo**, fiel pixel-perfect al diseño de Claude Design
  (los archivos `cg-*.jsx`), montado en Vite y conectado a datos reales de Supabase.
- **Repositorio:** https://github.com/CarnicosGustavo/ui-CarnicosGustavo
- **Rama de trabajo/deploy:** `main`
- **Deploy (Vercel):** **`1.carnicosgustavo.com`** (dominio de *desarrollo/pruebas*).
- **Ubicación local (este entorno):** `/home/claude/ui-cg`

## 🎯 Propósito
Reemplazar la UI actual (shadcn, del Proyecto 1) por **la interfaz de diseño tal cual**,
con datos reales. Regla de oro: **NO se reescribe el JSX de las pantallas** (`cg-*.jsx`
son la interfaz final); solo se cablean datos/acciones y se ajustan `onClick`.

## 🔗 Relación con el PROYECTO 1 (M1-Gestion-CarnicosGustavo)
- El **Proyecto 1** es el sistema actual completo (backend + UI shadcn + lógica de negocio).
- El **Proyecto 2 (este)** es **solo la UI nueva**; **comparte la misma base de datos
  Supabase** del Proyecto 1 (proyecto `uajezdrnqujmutjokwfo`).
- Este proyecto **no usa tRPC**: lee/escribe Supabase mediante **funciones serverless
  propias** (`api/`) con la *service-role key*. El contrato de negocio se replicó desde
  la API tRPC del Proyecto 1 (ver `docs/IMPLEMENTACION_DESDE_M1.md`).

## 🧱 Stack
- **React 18.3.1** vía **UMD/CDN** (no se bundlea). Pantallas = `cg-*.jsx` (JSX con
  estilos inline + globales `window.CG`). **Sin TypeScript, sin shadcn, sin Tailwind.**
- **Vite 6** (build → `dist`). **Babel** (`preset-env` ES5 + `preset-react`) transpila
  cada `cg-*.jsx` → `public/cg/*.js` como **scripts clásicos** (conserva globales).
- **Iconos:** `lucide` (UMD CDN). **Fuentes:** Anton / Archivo / JetBrains Mono.
- **Datos:** funciones serverless Vercel `api/cg-data.js` (lectura) y `api/write.js`
  (escritura) con **`@supabase/supabase-js`** (service-role). Cliente: `CG.refresh()`
  y `CG.write(op, params)`.
- **DB:** Supabase Postgres (la misma del Proyecto 1).
- **Test:** smoke test con `jsdom` (`scripts/smoke-test.mjs`).

## 📁 Estructura
```
ui-CarnicosGustavo/
├── index.html              # entry Vite: carga React/lucide (UMD) + cg-*.js
├── cg-*.jsx                # PANTALLAS (diseño final — no reescribir)
├── scripts/build-cg.mjs    # transpila cg-*.jsx → public/cg/*.js
├── scripts/smoke-test.mjs  # prueba de montaje (jsdom)
├── api/cg-data.js          # serverless: LECTURA (Supabase → CG.*)
├── api/write.js            # serverless: ESCRITURA (op dispatch)
├── public/assets/          # logos/imágenes (servidos por Vite)
├── vite.config.js · vercel.json
└── docs/                   # ver abajo
```

## ▶️ Cómo correr
```
npm install
npm run dev      # transpila + Vite dev
npm run build    # producción → dist/
npm test         # smoke test (jsdom)
```
Env (Vercel): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CG_USER_UID` (opcional).

## 📚 Documentación clave (en `docs/`)
- `MONTAJE_VITE.md` — arquitectura del montaje (cómo se conserva el JSX en Vite).
- `M1_GUIA_UI_UX.md` — guía funcional exhaustiva del Proyecto 1 (referencia de UI/UX).
- `IMPLEMENTACION_DESDE_M1.md` — mapeo pantalla→endpoint + contrato API tRPC del P1.
- `TAREAS_POR_PANTALLA.md` — **estado vivo por pantalla** (✅ hecho / 🔧 pulir / ⏳ pendiente).

## ✅ Estado (resumen)
- Lectura de datos reales: ✅ (14 secciones `CG.*` desde Supabase, con fallback a mock).
- Escritura: ciclo operativo (POS→Báscula→Cobro→Cobranza) + clientes/productos/caja/
  frío/métodos de pago/compra → ✅ persisten. Pendientes y notas de riesgo (stock,
  resets) en `TAREAS_POR_PANTALLA.md`.

## 🆚 Para comparar UI/UX con el Proyecto 1
- **Proyecto 1** (`dashboard.carnicosgustavo.com`): UI shadcn, genérica, completa y
  estable; es la referencia funcional.
- **Proyecto 2** (`1.carnicosgustavo.com`, este): UI de diseño (cremas, fuentes display,
  Ramón en el header, layout táctil); más fiel a la marca, en proceso de cablear toda
  la funcionalidad. Comparar pantalla por pantalla usando `docs/M1_GUIA_UI_UX.md` +
  `docs/TAREAS_POR_PANTALLA.md`.
