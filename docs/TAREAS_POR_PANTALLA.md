# Tareas por pantalla — ui-CarnicosGustavo (tracker)

Leyenda: ✅ hecho · 🔧 cableado flojo / a pulir · ⏳ pendiente (no persiste / falta) · 💡 mejora

> Estado al commit `e882048`. Endpoints reales: ver `docs/IMPLEMENTACION_DESDE_M1.md`.

## Global / shell
- ✅ Ramón en header (idle/alerta/pedido, clic→Panel, pulso al crear pedido)
- ✅ Rail sin isotipo; logo del Panel actualizado
- ✅ Assets servidos desde `public/assets/` (antes 404 en deploy)
- ✅ Datos reales vía `/api/cg-data` (lectura); `CG.write` (escritura)
- 🔧 Avatar/Perfil del header → abre Perfil (ok); revisar menú de usuario
- ✅ **Notificaciones in-app** (campana en el header, `cg-notifs.jsx`): badge de no
  leídas + panel; avisos derivados del estado real (pesajes pendientes, listos para
  cobro, saldos vencidos, faltantes). Cada aviso navega (Ir) o pregunta a Antonella.
  'Leído' en localStorage; sincroniza el punto rojo de Ramón.
- ✅ Antonella (dock/chat): `CG.ask`→`/api/antonella` (Anthropic real si hay
  `ANTHROPIC_API_KEY`; si no, mock). **Con datos reales**: `CG.buildContext()` manda un
  snapshot (KPIs del día, pedidos por estado, saldos vencidos, faltantes) inyectado en
  el system prompt → responde con cifras concretas. **Acciones**: navega (`a.go`) y puede
  ejecutar ops (`a.op`) con PIN si es sensible (`a.auth`).
- ⏳ tool-use estructurado (que el modelo elija la acción/op) — siguiente paso
- ✅ **Herramienta de feedback in-browser** (`cg-feedback.jsx`, estilo Vercel Toolbar):
  modo "Comentar" deja pins con nota+tipo (Bug/Idea/Usabilidad/Nota), captura elemento y
  pantalla, panel con lista y **Exportar informe** (.md + portapapeles). localStorage.
- ✅ Campana del header consume avisos **reales** (`/api/notifications`) con fallback a
  derivados de `CG.ops`; `NotificationCenter` (config-antonella) también cableado al real.
- ⏳ **Dashboard de Configuración** ("tipo tweaks") — plan en `docs/PLAN_CONFIG_DASHBOARD.md`
- ✅ **Centro "Pendientes y Autorizaciones"** (`cg-agente.jsx`, ruta `pendientes`): tareas
  pendientes (avisos reales + fallback) + **bitácora de autorizaciones** (`CG.authLog`,
  cada acción aprobada con PIN queda registrada) + resumen de iAntonella. Acceso desde la
  campana ("Ver pendientes y autorizaciones").

## Panel
- ✅ Lectura (KPIs, categorías, flujo) · ✅ ocultar/mostrar montos
- 💡 nada crítico

## Compra del día
- ✅ Lectura (proveedores, totales) · ✅ agregar/limpiar proveedores (local)
- ✅ **Guardar compra del día** persiste → `purchases.save` (sin re-sync de stock, a validar)
- 🔧 celdas de la tabla no son editables individualmente (solo display)

## Pedidos (lista + detalle)
- ✅ **Crear pedido** (modal) persiste → `order.create`
- ✅ CSV / imprimir / ordenar / duplicar (local)
- ✅ **Ver detalle / Imprimir ticket** → imprime **ticket real** (`/api/ticket`): productos,
  cantidades, total, estado de pago (ventana de impresión formateada)
- ✅ **Editar pedido** precarga las líneas reales (`/api/order`) en el modal y guarda →
  `order.replaceItems` (reemplaza líneas, recalcula total/estado, ajusta cargo/transacción)
- ✅ Cancelar (→cancelled) / Eliminar persisten → `order.update/delete`
- 🔧 editar líneas por PESO mantiene su kg pero el modal solo ajusta piezas (pesaje recaptura)
- 🔧 WhatsApp sin teléfono del cliente (texto genérico)

## Despiece
- ✅ Selección de canal, stepper, navegación
- ✅ **Despiezar / Despiezar N** persiste → `despiece.process` (descuenta canal, suma hijos
  por receta efectiva BASE+tipo, registra transacciones); usa `canal.pid` + `canal.tt` reales
- ✅ **"Pedidas" = demanda viva** real: `ped` por pieza desde order_items de pedidos abiertos

## Báscula
- ✅ Recipientes/tara/neto, navegación de artículos
- ✅ **Registrar peso** persiste → `order.weighItem` (recalcula total/estado; pasa a cobro al terminar)

## Cobro
- ✅ Precio/kg editable, método, total
- ✅ **Cobrar** persiste → `order.priceAndCharge` (precios + COMPLETADA + transacción/crédito)
- 🔧 **descuento de stock** NO se hace aún (a validar antes de activarlo)
- 🔧 UI single-line (1 precio); pedidos multi-línea aplican el mismo input al 1º

## Rendimiento
- ✅ Proyectar piezas (local)
- ✅ **Guardar hoja** persiste → `yield.save` (yield_sheets + items, kg en kilos)
- ✅ **Calibrar recetas** persiste → `yield.calibrate` (recalcula yield_weight_ratio con
  pesos reales COMPLETADO del día; raíz=kg/canalTotal, sub=kg/padre) · con confirm + test

## CEDIS (módulo nuevo de diseño)
- ✅ ops backend: `cedis.addSupplier`, `cedis.save` (verified_*/cedis_detail), `purchase.recordSupplier`
- ✅ **cableado**: lee `channel_purchases` del día con ids reales (`/api/cedis`), restaura
  medias capturadas, **Guardar** → `cedis.save`, **Agregar proveedor** → `cedis.addSupplier`
- ✅ **gate por código CEDIS** (PIN `cedis`, 1×sesión)

## Cobranza
- ✅ **Abonar** persiste → `abono` · ✅ WhatsApp
- ✅ **Estado de cuenta** (modal) ahora con **ledger real** (`/api/statement`): lista de
  cargos/abonos por fecha + totales
- ✅ **Capturar ticket viejo** (modal cliente/monto/concepto) → `cargo`
- ✅ ops backend de edición: `charge.update/delete`, `payment.updateAmount/deleteAbono`,
  `account.set` (límite/plazo) — listas para cablear controles de edición
- 🔧 "Ver pedidos a crédito" → Pedidos sin filtrar por cliente

## Clientes (lista + detalle)
- ✅ **Crear / Editar / Eliminar** persisten → `customer.*`
- ✅ "Nuevo pedido" → POS **precargando** el cliente
- ✅ **Ficha 360°** (`/api/customer` + `/api/statement`): contacto, KPIs (pedidos/gastado/
  saldo/precios propios), pedidos recientes y movimientos de cuenta · ruta `ficha`
- ✅ "Estado de cuenta" y "Ver ficha 360°" → abren la ficha del cliente

## POS
- ✅ **Crear pedido** persiste · ✅ dropdowns (cliente/método/lista) selección libre
- ✅ **precio por cliente**: al elegir cliente carga sus precios (`/api/customer-prices`) y re-precia carrito + catálogo
- 🔧 **disponibilidad** del catálogo es aproximada (no usa `availabilityMap` con derivable)

## Recetas / Configurador
- ✅ **lectura real**: `out.recetas` desde `product_transformations` (styles/rows/kids/pct/variant),
  agrupado por canal raíz; `palette` = productos reales por categoría; embebe `pid`/`tid`
- ✅ **persiste edición** de filas existentes: `%`→`recipe.quickUpdate(yieldWeightRatio)`,
  `pz`→`yieldQuantityPieces`, variante→`isVariant`; peso del canal→`recipe.setRefWeight`
- ✅ **agregar/quitar pieza**: `recipe.upsert` (crea el vínculo, captura `tid`) · borrar→`recipe.setActive(false)`
- 🔧 fila recién agregada arranca en 0%; su `%` persiste tras capturar el `tid` del upsert
- 💡 edición de sub-piezas de 3er nivel: render ok, edición limitada (pre-existente)

## Productos
- ✅ buscar · ✅ **agregar/editar/borrar** persisten → `product.*` · importar (file picker)
- 🔧 editar solo nombre (prompt); falta editar precio/stock/categoría

## Precios por cliente
- ✅ **dropdown de cliente** + carga precios del cliente (`/api/customer-prices`)
- ✅ precio/kg editable, filas con precio propio resaltadas
- ✅ **Guardar** persiste → `prices.bulkUpsert`

## Inventario Frío
- ✅ **A frío / A fresco** con **diálogo de kg/piezas** → `cold.toFrozen/toFresh`
- ✅ **gate por código de Frío** (PIN `frio`, 1×sesión)

## Caja
- ✅ **Agregar** + **Eliminar** persisten · ✅ lee transacciones reales (`config.caja`) · ⏳ editar

## Métodos de pago
- ✅ **Crear / Editar / Eliminar** persisten → `payment.*`

## Configuración (hub)
- ✅ accesos navegan · ✅ DangerCards validan pw+"RESET"
- ✅ **Reset** ejecuta → `reset.stock` (pone stock en cero) y `reset.customers`
  (borra clientes/pedidos/cobranza/precios + transacciones); requiere `confirm:"RESET"`
  y, si `ADMIN_RESET_PASSWORD` está en env, contraseña válida

## Perfil / Seguridad
- ✅ tema (claro/oscuro), prompts email/pass
- ✅ **login persistente**: el desbloqueo se recuerda entre sesiones (localStorage `cg_session`);
  botón de **candado** en el header re-bloquea (privacidad) y pide el PIN
- ✅ **PINs configurables** en *Configuración › Seguridad y PINs* (privacidad / CEDIS / Frío),
  vía `CG.getPin/setPin/checkPin` + compuerta `CG.requirePin(kind, onOk)` (módulo `cg-pin.jsx`)
- ✅ **montos del Panel ocultos por defecto**; "Mostrar montos" pide el PIN de privacidad
- ✅ **PIN de autorización** (= el de privacidad) gatea acciones sensibles / no reversibles
  vía `CG.requireAuth(onOk, msg)`: cancelar/eliminar pedido, eliminar cliente, eliminar
  producto, eliminar movimiento de caja, recalibrar recetas y **resets** (además de la
  contraseña admin). **Antonella** también lo pide: acciones con `a.auth`/`a.op` piden PIN
  antes de ejecutar la op.
- ⏳ auth con credenciales reales (backend) pendiente: hoy el PIN de privacidad es la puerta

---

## Próximos lotes (orden sugerido)
1. **Cerrar flujo operativo:** Báscula `weighItem` → Cobro `priceAndCharge`.
2. **Polish de mapeos flojos:** Clientes "Nuevo pedido" precarga cliente; Frío diálogo kg/pz; Precios dropdown + persistir; Cobranza "Capturar ticket viejo".
3. **Persistir catálogo:** Productos `create/update/delete`; Caja edit/delete; Compra `savePurchases`.
4. **Resets** de Configuración; **Despiece** `processDisassembly`; **Rendimiento** writes.
5. Recetas (opcional) y Antonella chat.
