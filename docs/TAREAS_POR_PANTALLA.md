# Tareas por pantalla — ui-CarnicosGustavo (tracker)

Leyenda: ✅ hecho · 🔧 cableado flojo / a pulir · ⏳ pendiente (no persiste / falta) · 💡 mejora

> Estado al commit `e882048`. Endpoints reales: ver `docs/IMPLEMENTACION_DESDE_M1.md`.

## Global / shell
- ✅ Ramón en header (idle/alerta/pedido, clic→Panel, pulso al crear pedido)
- ✅ Rail sin isotipo; logo del Panel actualizado
- ✅ Assets servidos desde `public/assets/` (antes 404 en deploy)
- ✅ Datos reales vía `/api/cg-data` (lectura); `CG.write` (escritura)
- 🔧 Avatar/Perfil del header → abre Perfil (ok); revisar menú de usuario
- ⏳ Antonella (dock/chat): respuestas mock → cablear `antonella.chat`

## Panel
- ✅ Lectura (KPIs, categorías, flujo) · ✅ ocultar/mostrar montos
- 💡 nada crítico

## Compra del día
- ✅ Lectura (proveedores, totales) · ✅ agregar/limpiar proveedores (local)
- ⏳ **Guardar compra del día** no persiste → `yields.savePurchases`
- 🔧 celdas de la tabla no son editables individualmente (solo display)

## Pedidos (lista + detalle)
- ✅ **Crear pedido** (modal) persiste → `order.create`
- ✅ CSV / imprimir / ordenar / duplicar (local)
- 🔧 **Ver detalle / Editar** solo imprime/abre modal vacío → falta detalle real
- ⏳ Cancelar / Eliminar / Editar **no persisten** → `orders.update/delete`
- 🔧 WhatsApp sin teléfono del cliente (texto genérico)

## Despiece
- ✅ Selección de canal, stepper, navegación
- ⏳ **Despiezar / Despiezar N** no persiste → `products.processDisassembly`

## Báscula
- ✅ Recipientes/tara/neto, navegación de artículos (local)
- ⏳ **Registrar peso** no persiste → `order.weighItem` (necesita `orderItemId` real)
- 💡 traer lista de items con id en `data.bascula`

## Cobro
- ✅ Precio/kg editable, método, total (local)
- ⏳ **Cobrar** no persiste → `order.priceAndCharge` (precios + estado + transacción/crédito)
- 💡 traer `orderId`/`orderItemId` en `data.cobro`; descuento de stock a validar

## Rendimiento
- ✅ Proyectar/Guardar/Calibrar (local + nav)
- ⏳ no persisten → `yields.create` / `projectFromCanales` / `calibrateFromDay`

## Cobranza
- ✅ **Abonar** persiste → `abono` · ✅ **Estado de cuenta** (modal) · ✅ WhatsApp
- ⏳ **Capturar ticket viejo** (header) → `cargo` (no cableado)
- 🔧 "Ver pedidos a crédito" → Pedidos sin filtrar por cliente

## Clientes (lista + detalle)
- ✅ **Crear / Editar / Eliminar** persisten → `customer.*`
- 🔧 "Nuevo pedido" → POS sin precargar cliente
- 🔧 "Estado de cuenta" → Cobranza sin filtrar
- ⏳ Ficha 360° (detalle) no existe

## POS
- ✅ **Crear pedido** persiste · ✅ dropdowns (cliente/método/lista) selección libre
- 🔧 **precio** usa base, no resuelve por cliente/lista (`customerPrices`/lista)
- 🔧 **disponibilidad** del catálogo es aproximada (no usa `availabilityMap` con derivable)

## Recetas / Configurador
- ✅ funcional con semilla mock (la pantalla más rica)
- ⏳ (opcional, alto esfuerzo) mapear a DB + `inventory.recipes*`

## Productos
- ✅ buscar/agregar/editar/borrar (local) · importar (file picker)
- ⏳ **no persisten** → `products.create/update/delete` (admin)

## Precios por cliente
- ✅ precios editables, guardar (feedback local)
- 🔧 selector de cliente cicla (debería dropdown)
- ⏳ **Guardar** no persiste → `prices.bulkUpsert` (falta `customerId` + `productId`)

## Inventario Frío
- ✅ **A frío / A fresco** persisten → `cold.toFrozen/toFresh`
- 🔧 transfiere TODO el stock (no pide kg/piezas)

## Caja
- ✅ **Agregar** persiste → `tx.create`
- ⏳ editar/eliminar no persisten · lectura (`transactions.list`) no mapeada en `/api/cg-data`

## Métodos de pago
- ✅ **Crear / Editar / Eliminar** persisten → `payment.*`

## Configuración (hub)
- ✅ accesos navegan · ✅ DangerCards validan pw+"RESET"
- ⏳ **Reset** no ejecuta → `inventory.resetAllStock/resetCustomersAndOrders`

## Perfil
- ✅ tema (claro/oscuro), cerrar sesión (local), prompts email/pass
- ⏳ auth real (Better-Auth) pendiente

---

## Próximos lotes (orden sugerido)
1. **Cerrar flujo operativo:** Báscula `weighItem` → Cobro `priceAndCharge`.
2. **Polish de mapeos flojos:** Clientes "Nuevo pedido" precarga cliente; Frío diálogo kg/pz; Precios dropdown + persistir; Cobranza "Capturar ticket viejo".
3. **Persistir catálogo:** Productos `create/update/delete`; Caja edit/delete; Compra `savePurchases`.
4. **Resets** de Configuración; **Despiece** `processDisassembly`; **Rendimiento** writes.
5. Recetas (opcional) y Antonella chat.
