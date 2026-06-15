# Plan — Dashboard de Configuración ("tipo tweaks")

> Objetivo: al entrar a **Configuración**, mostrar arriba un **panel del estado actual
> del sistema** (salud + ajustes rápidos), antes de los accesos a submódulos. Estilo
> "tweaks": de un vistazo se ve qué está configurado, qué falta y se ajusta rápido.

## Ubicación
- En `cg-config.jsx`, dentro de `ConfigScreen`, **prepend** un componente nuevo
  `ConfigDashboard` antes de la grilla de accesos (`window.CG.configItems`).
- No reescribe el diseño: usa los componentes existentes (`Card`, `Stat`, `Badge`,
  `Btn`, `Icon`) y los tokens (`Cc`, `Fc`).

## Secciones del dashboard

### 1) Salud del sistema (semáforos)
Tarjetas con estado verde/ámbar/rojo, derivadas de datos reales:
- **Conexión de datos**: ¿`/api/cg-data` devolvió `_source:"supabase"` o mock? (exponer
  `CG.meta.source` al refrescar).
- **iAntonella**: ¿hay `ANTHROPIC_API_KEY`? (el endpoint puede devolver `_source` en un
  ping; o un `/api/health`).
- **Notificaciones**: ¿`/api/notifications` real o mock? (ya devuelve `_source`).
- **Seguridad/PINs**: ¿los 3 PINs siguen en `0000`? (leer localStorage) → avisar que se
  cambien.

### 2) Salud de la configuración (lo que falta)
Lista accionable computada de `CG.ops` (cliente) o un `/api/config-status` (servidor):
- Productos con **precio en $0**.
- Productos **sin stock / faltantes**.
- Recetas **sin calibrar** o con merma fuera de rango.
- Clientes **sin lista de precios** asignada.
- Métodos de pago **inactivos**.
Cada ítem enlaza a su módulo (`__cgGo`) y/o "Preguntar a iAntonella".

### 3) Tweaks rápidos (toggles)
Ajustes que hoy están dispersos, centralizados aquí:
- **Tema** (claro/oscuro) y **paleta** (cálida/neutra) — ya existe `__cgSetTheme`.
- **Montos ocultos por defecto** en el Panel (hoy fijo `true`) → preferencia en
  localStorage `cg_hide_default`.
- **Pedir PIN en acciones sensibles** (on/off) → `cg_auth_required` (default on).
- **Fuente de avisos**: auto (real si hay datos, si no mock) — informativo.

### 4) Resumen / contadores
`Stat` con: # productos, # recetas activas, # clientes, # métodos de pago,
# PINs configurados (≠0000), # avisos abiertos.

## Datos
- **Cliente primero** (rápido, sin endpoint): derivar todo de `CG.ops` + localStorage +
  `_source` que ya traen los endpoints. Cubre el 80%.
- **Opcional** `/api/config-status` (réplica de un "health" de M1) para cifras que no
  estén en `CG.ops` (p. ej. clientes sin lista de precios) — segunda fase.

## Fases
1. **F1 (sólo cliente):** `ConfigDashboard` con Salud (semáforos desde `_source` +
   PINs), Tweaks (tema, montos default, PIN on/off) y contadores desde `CG.ops`.
2. **F2:** `/api/config-status` para "lo que falta" con cifras reales (precios en cero,
   clientes sin lista, recetas sin calibrar).
3. **F3:** enlazar cada hallazgo a su módulo + "Preguntar a iAntonella" y a las
   notificaciones (mismas fuentes).

## Riesgos / notas
- Exponer `_source` requiere un pequeño cambio en `CG.refresh` (guardar `CG.meta`).
- Evitar duplicar lógica de avisos: reutilizar `/api/notifications` y `CG.buildNotifs`.
- Mantenerlo liviano: el dashboard no debe disparar muchas llamadas (1 refresh + 1
  status como máximo).
