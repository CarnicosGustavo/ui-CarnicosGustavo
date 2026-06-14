# Montaje en Vite — UI Cárnicos Gustavo

La interfaz **final** son los `cg-*.jsx` (exportados de Claude Design). **No se
reescriben ni se cambian estilos.** Esta app solo los **monta en Vite** con datos
reales; el criterio es **pixel por pixel** igual al diseño.

## Cómo funciona

Los `cg-*.jsx` no son módulos ES: comparten scope global (`window.CG`, `React`,
y funciones entre archivos como `Card`, `Icon`, `ScreenHead`). Para conservarlos
**idénticos** bajo Vite:

1. `scripts/build-cg.mjs` transpila cada `cg-*.jsx` → `public/cg/*.js` con Babel
   (preset-react + preset-env a ES5). Bajar a ES5 convierte `const/let` en `var`,
   de modo que las declaraciones top-level quedan **globales y compartidas** entre
   scripts — igual que hacía Babel-en-navegador, pero ahora en build.
2. `index.html` carga React/ReactDOM/lucide (UMD) y luego los `cg-*.js` como
   **scripts clásicos** (no módulos), en el mismo orden del prototipo.
3. Vite sirve/empaqueta todo (`public/` → `dist/`). Sin Babel en el cliente.

> Regla de oro: **solo se edita `cg-data.jsx`** (la fuente de datos). El resto de
> `cg-*.jsx` queda intacto.

## Comandos

```bash
npm install
npm run dev       # desarrollo (transpila + Vite dev server)
npm run build     # producción → dist/
npm run preview   # previsualiza el build
npm test          # smoke test: monta la app en jsdom y verifica que renderiza
```

## Estado

- **Hito 1 ✅** — montaje en Vite, pixel idéntico, con los **datos mock** actuales
  de `cg-data.jsx`. Verificado: `npm test` monta `<App/>` y renderiza sin errores.
- **Hito 2 (en curso)** — datos reales desde **Supabase** vía función serverless.
  - `api/cg-data.js` (Vercel) lee Supabase con la *service-role key* del lado
    servidor y devuelve JSON con forma `CG.*`. El secreto nunca llega al navegador.
  - `cg-data.jsx` hace `CG.refresh()` → `fetch('/api/cg-data')` y **fusiona** sobre
    los mock (mismas claves). Si la API no responde, conserva los mock.
  - Al llegar los datos dispara `cg:data` y la app se re-renderiza.
  - **Mapeado:** `data.panel`, `data.compra`, `data.despiece`, `data.bascula`,
    `data.cobro`; `config.productos`, `config.precios`, `config.cold`,
    `config.payment`; `ops.pedidos`, `ops.clientes`, `ops.cobranza`,
    `ops.rendimiento`, `ops.pos`. (Recetas conserva la semilla real del mock.)
  - **Variables de entorno en Vercel** (Production/Preview/Development):
    - `SUPABASE_URL` = `https://uajezdrnqujmutjokwfo.supabase.co`
    - `SUPABASE_SERVICE_ROLE_KEY` = (secreto — solo en Vercel, nunca en el repo)
    - `CG_USER_UID` = (opcional) filtra por dueño; si se omite, lee todo.

### Funcionalidad de botones (Fase 2)
Cada botón ejecuta una acción real (navega / abre modal / calcula / guarda).
Ningún botón de acción "solo abre el chat". Los botones que **sí** envían al chat
de iAntonella (chips de sugerencia) llevan un **icono de flecha hacia el chat**.

## Deploy (Vercel)

- `vercel.json`: `buildCommand: npm run build`, `outputDirectory: dist`,
  `framework: vite`.
- Dominio de desarrollo previsto: **`1.carnicosgustavo.com`**.
- Backend de datos: Supabase `uajezdrnqujmutjokwfo` (proyecto del sistema actual).
