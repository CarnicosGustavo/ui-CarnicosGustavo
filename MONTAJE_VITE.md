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
- **Hito 2 (pendiente)** — reescribir **solo `cg-data.jsx`** para llenar `CG.*`
  (`CG.data`, `CG.config`, `CG.ops`, `CG.recetas`, `CG.antonella`, `CG.chat`)
  desde **Supabase**, manteniendo las mismas claves.
  - Acordado: los datos llegan vía una **función serverless** (Vercel) que lee
    Supabase con la *service-role key* del lado servidor y devuelve el JSON ya con
    forma `CG.*`. `cg-data.jsx` solo hace `fetch('/api/cg-data')`. El secreto nunca
    llega al navegador y no hay que tocar RLS.

## Deploy (Vercel)

- `vercel.json`: `buildCommand: npm run build`, `outputDirectory: dist`,
  `framework: vite`.
- Dominio de desarrollo previsto: **`1.carnicosgustavo.com`**.
- Backend de datos: Supabase `uajezdrnqujmutjokwfo` (proyecto del sistema actual).
