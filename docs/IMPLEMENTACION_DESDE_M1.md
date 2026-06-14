# Implementación desde M1 → ui-CarnicosGustavo

> **Qué es:** el *playbook* para llevar todas las funcionalidades del sistema actual
> (M1 `M1-Gestion-CarnicosGustavo`, stack shadcn) a la nueva UI (`ui-CarnicosGustavo`,
> los `cg-*.jsx` montados en Vite).
>
> **Referencias hermanas en este repo:**
> - [`M1_GUIA_UI_UX.md`](./M1_GUIA_UI_UX.md) — guía funcional exhaustiva del M1 (cada
>   pantalla, cada botón, estados). Es la fuente de verdad de **qué** hace cada cosa.
> - Este documento — el **mapa de implementación**: cada pantalla `cg-*` → su
>   equivalente M1 → endpoint real con params → estado actual en ui-cg → qué falta.
> - Apéndice A — contrato completo de la API tRPC (endpoints + inputs exactos).

---

## 0. Cómo fluyen datos y acciones en la UI nueva

**Lectura (ya implementado, Hito 2):**
`cg-data.jsx` → `CG.refresh()` → `fetch('/api/cg-data')` (función serverless con
service-role) → **deep-merge** sobre los mock con las mismas claves → evento `cg:data`
→ re-render. Si la API falla, se conservan los mock. Secciones mapeadas: `data.panel`,
`data.compra`, `data.despiece`, `data.bascula`, `data.cobro`, `config.productos`,
`config.precios`, `config.cold`, `config.payment`, `ops.pedidos`, `ops.clientes`,
`ops.cobranza`, `ops.pos`, `ops.rendimiento`. (Recetas conserva la semilla del mock.)

**Acciones / escritura (PENDIENTE — el gran trabajo que sigue):**
Hoy los botones de la UI nueva ejecutan **estado local + navegación** (no persisten en
Supabase). Para que persistan hay que darles un **camino de escritura**. Dos opciones:

- **Opción A (recomendada): endpoints serverless de escritura** en `api/` que repliquen
  los mutations de tRPC usando la service-role key (p. ej. `POST /api/order` →
  `orders.create`). Mantiene el secreto en el servidor; la UI hace `fetch`.
- **Opción B: apuntar a la API tRPC del M1** directamente (requiere auth de sesión
  compartida y CORS). Reusa toda la lógica/permisos pero acopla las dos apps.

> El **Apéndice A** lista el input exacto de cada mutation: es el contrato que deben
> cumplir esos endpoints de escritura, sin importar la opción.

**Notas críticas (válidas para todo):**
1. **kg en gramos** en `orders.create` (`quantityKg`) y `orders.updateOrderItemWeight`
   (`actualWeightKg`, int) → multiplicar kg ×1000 al enviar. En pesaje por lote /
   ajustes / frío / compra-proveedor, kg va como decimal normal.
2. **Dinero:** pedidos/transacciones internos en **centavos** (÷100 al mostrar);
   `priceAndCharge`/`replaceItems` reciben precios en **pesos**; `transactions.create`
   recibe `amount` en **centavos**; cobranza (`creditCharges/Payments`) en **pesos**.
3. **`customers.create` exige `email` válido** (en `update` es opcional). La UI nueva
   debe pedir/derivar un email (el M1 deriva `…@cedis.local`).
4. **Roles:** catálogo y recetas son `adminProcedure`; despiece/pesaje físicos son
   `almacenProcedure`. Condiciona qué botones mostrar por rol.

---

## 1. Mapa maestro: pantalla cg-* → M1 → estado

| cg (módulo) | M1 ruta | Lectura `/api/cg-data` | Acciones reales (persistencia) |
|---|---|---|---|
| `panel` | `/admin` | OK `data.panel` | lectura; sin acciones |
| `compra` | `/admin/purchase` | OK `data.compra` | pend. `yields.savePurchases` |
| `pedidos` | `/admin/orders` (+`[id]`) | OK `ops.pedidos` | pend. `orders.create/update/delete/replaceItems` |
| `despiece` | `/admin/despiece` | OK `data.despiece` | pend. `products.processDisassembly`, `convertToVariant` |
| `bascula` | `/admin/weighing-station` | OK `data.bascula` | pend. `orders.updateOrderItemWeight` |
| `cobro` | `/admin/checkout` | OK `data.cobro` | pend. `orders.priceAndCharge` |
| `rendimiento` | `/admin/yield` | OK `ops.rendimiento` | pend. `yields.create`, `calibrateFromDay`, `projectFromCanales` |
| `cobranza` | `/admin/collections` | OK `ops.cobranza` | pend. `collections.addPayment/addCharge/...` |
| `clientes` | `/admin/customers` (+`[id]`) | OK `ops.clientes` | pend. `customers.create/update/delete` |
| `pos` | `/admin/pos` | OK `ops.pos` | pend. `orders.create` (resolviendo precios) |
| `recetas` | `/admin/inventory/recipes` | — (mock semilla) | pend. `inventory.recipesUpsert/...` |
| `productos` | `/admin/products` | OK `config.productos` | pend. `products.create/update/delete` |
| `precios` | `/admin/prices` | OK `config.precios` | pend. `customerPrices.bulkUpsert` |
| `cold` | `/admin/cold-inventory` | OK `config.cold` | pend. `cold-inventory.toFrozen/toFresh` |
| `caja` | `/admin/cashier` | (no mapeado) | pend. `transactions.create/update/delete` |
| `payment` | `/admin/payment-methods` | OK `config.payment` | pend. `paymentMethods.create/update/delete` |
| `config/settings` | `/admin/settings` | — | pend. `inventory.resetAllStock/resetCustomersAndOrders` |
| `perfil` | `/admin/profile` | — (sesión) | pend. auth (cambiar email/pass, cerrar sesión) |
| Antonella | `/admin/antonella` | — | pend. `antonella.chat/executeAction` |

Leyenda: OK = lectura cableada · pend. = acción aún en estado-local (falta persistir).

---

## 2. Detalle por pantalla (datos · botones→endpoint · inputs · estado)

### Panel (`panel` → `/admin`)
- **Lectura:** `data.panel` (ingresos, gastos, ganancia, margen, ingresosCat, flujo). Backend: `dashboard.stats`.
- **Botones:** "Ocultar/Mostrar montos" → toggle local (ya funciona). Sin acciones server.
- **Estado ui-cg:** completo (lectura + privacidad).

### Compra del día (`compra` → `/admin/purchase`)
- **Lectura:** `data.compra`. Backend: `yields.purchasesByDate`.
- **Botones → acción real:** "Guardar compra del día" → `yields.savePurchases({date, rows:[{supplier,canales,kg,precio,americano,nacional,verifCanales,verifKg}]})`; fecha → `yields.purchasesByDate({date})`; "Días guardados" → `yields.purchaseDates`.
- **Estado ui-cg:** estado local + navega a Rendimiento. **TODO:** `savePurchases`.

### Pedidos (`pedidos` → `/admin/orders`, `[id]`)
- **Lectura:** `ops.pedidos`. Backend: `orders.list`, `orders.get({id})`.
- **Acciones:** create `{customerId,paymentMethodId?,items:[{productId,quantityPieces?,quantityKg?(gramos),unitPrice(centavos),requiresPurchase?}],notes?}`; update `{id,total_amount?(centavos),status?}`; replaceItems `{orderId,items:[{productName,quantityPieces,quantityKg,unitPrice(pesos)}]}`; delete `{id}`; cobrar `completeOrderPayment/{completeOrderOnCredit}`; `convertToCredit`. Ticket: `tickets.generateTicket({orderId})`.
- **Estado ui-cg:** acciones de fila (nav/imprimir/CSV/WhatsApp/duplicar/cancelar) en local; modal NuevoPedido existe. **TODO:** persistir create/update/delete.

### Despiece (`despiece` → `/admin/despiece`)
- **Lectura:** `data.despiece`. Backend: `yields.despiecePanel`, `products.getTransformations`, `yields.suggestDespiecePlan`.
- **Acciones:** `products.processDisassembly({parentProductId,quantityToProcess,transformationType})` (almacen); `products.convertToVariant({baseProductId,variantProductId,pieces})`.
- **Estado ui-cg:** "Despiezar" descuenta local + navega a Báscula. **TODO:** `processDisassembly`.

### Báscula (`bascula` → `/admin/weighing-station`)
- **Lectura:** `data.bascula`. Backend: `orders.getPendingWeighingOrders` (8s).
- **Acciones:** "Registrar N kg" → `orders.updateOrderItemWeight({orderItemId,actualWeightKg:int(gramos)})`; producción → `createProductionWeighing`/`inventory.recordWeighingBatch`.
- **Estado ui-cg:** registrar avanza/→Cobro local; tara/neto OK. **TODO:** `updateOrderItemWeight` (kg→gramos).

### Cobro (`cobro` → `/admin/checkout`)
- **Lectura:** `data.cobro`. Backend: `orders.getReadyToCharge` (10s, trae `savedPriceKg`).
- **Acciones:** "Cobrar $X" → `orders.priceAndCharge({orderId,paymentType:"contado"|"credito",paymentMethodId?,items:[{orderItemId,productId,pricePerKg(pesos)}]})`.
- **Estado ui-cg:** precio editable + método ciclable + Cobrar→Pedidos local. **TODO:** `priceAndCharge`.

### Rendimiento (`rendimiento` → `/admin/yield`)
- **Lectura:** `ops.rendimiento`. Backend: `yields.list/byProvider`.
- **Acciones:** "Guardar hoja" → `yields.create({numCanales,kgComprado,supplier?,items:[{productName,pieces,kgTotal,weighed}]})`; "Proyectar" → `yields.projectFromCanales({canales:[{canalProductId,numCanales}]})`; "Calibrar" → `yields.calibrateFromDay({date})`.
- **Estado ui-cg:** proyectar/guardar/calibrar local/nav. **TODO:** cablear los 3.

### Cobranza (`cobranza` → `/admin/collections`)
- **Lectura:** `ops.cobranza`. Backend: `collections.listAccounts`, `getStatement({customerId})`.
- **Acciones:** Abonar → `addPayment({customerId,amount(pesos),method?,notes?})`; ticket viejo → `addCharge({customerId,amount(pesos),concept?,source:"ticket_viejo"})`; corregir/eliminar → `update/deleteCharge|Payment`.
- **Estado ui-cg:** Abonar abre `AbonarModal`; WhatsApp/nav OK. **TODO:** `addPayment`/`addCharge`.

### Clientes (`clientes` → `/admin/customers`, `[id]`)
- **Lectura:** `ops.clientes`. Backend: `customers.list`, `getDetail({id})`.
- **Acciones:** create `{name,email(REQ),contact_name?,phone?,whatsapp_phone?,address?,status?,credit_limit?,terms_days?}`; update `{id,...}`; delete `{id}`.
- **Estado ui-cg:** editar abre `EditarClienteModal`; eliminar local; WhatsApp/CSV OK. **TODO:** `create/update/delete` (email obligatorio).

### POS (`pos` → `/admin/pos`)
- **Lectura:** `ops.pos`. Backend: `products.list`, `customers.list`, `paymentMethods.list`, `inventory.priceListsList`, `products.availabilityMap`, `customerPrices.getByCustomer`.
- **Acciones:** Crear pedido → `orders.create(...)`; precio resuelto cliente→lista→base; disponibilidad por `availabilityMap` (`derivable`→"por despiece").
- **Estado ui-cg:** carrito táctil + selects + crear→Báscula/Cobro local. **TODO:** `orders.create` + resolución real.

### Recetas (`recetas` → `/admin/inventory/recipes`)
- **Lectura:** mock semilla. Real: `inventory.recipesList`, `products.list({isParent:true})`, `getTransformations`.
- **Acciones:** `inventory.recipesUpsert/recipesQuickUpdate/recipesSetActive/setRefWeight/recipesImport`, `products.classifyOrphan`.
- **Estado ui-cg:** funcional con mock (la más rica). **TODO (opcional, alto esfuerzo):** mapear a DB + upserts.

### Productos (`productos` → `/admin/products`)
- **Lectura:** `config.productos`. Backend: `products.list`.
- **Acciones:** `products.create/update/delete` (admin); CSV → `inventory.priceListImportCsv`.
- **Estado ui-cg:** buscar/agregar/editar(prompt)/borrar local + file picker. **TODO:** persistir CRUD.

### Precios (`precios` → `/admin/prices`)
- **Lectura:** `config.precios`. Backend: `customerPrices.getByCustomer({customerId})`.
- **Acciones:** Guardar → `customerPrices.bulkUpsert({customerId,items:[{productId,pricePerKg,pricePerPiece}]})`.
- **Estado ui-cg:** cliente ciclable, precios editables, Guardar (feedback) local. **TODO:** `bulkUpsert` + selector real.

### Inventario Frío (`cold` → `/admin/cold-inventory`)
- **Lectura:** `config.cold`. Backend: `cold-inventory.list`.
- **Acciones:** A frío → `toFrozen({productId,kg,pieces})`; A fresco → `toFresh({...})`.
- **Estado ui-cg:** transferencias en estado local. **TODO:** diálogo kg/pz + `toFrozen/toFresh`.

### Caja (`caja` → `/admin/cashier`)
- **Lectura:** no mapeada. Backend: `transactions.list`. **TODO mapeo:** agregar sección en `/api/cg-data`.
- **Acciones:** Agregar → `transactions.create({description,amount(centavos,int),type:"income"|"expense",category?,status?})`; `update/delete`.
- **Estado ui-cg:** alta/listado local. **TODO:** mapear lectura + CRUD.

### Métodos de pago (`payment` → `/admin/payment-methods`)
- **Lectura:** `config.payment`. Backend: `paymentMethods.list`.
- **Acciones:** `create({name})`/`update({id,name})`/`delete({id})`.
- **Estado ui-cg:** alta/edición/baja local. **TODO:** persistir CRUD.

### Configuración (`config` → `/admin/settings`)
- **Acciones:** Reset inventario → `inventory.resetAllStock({adminPassword})`; Reset clientes/pedidos → `resetCustomersAndOrders({adminPassword})`.
- **Estado ui-cg:** hub navega; DangerCards validan pw+"RESET" con feedback local. **TODO:** llamar resets (admin).

### Perfil (`perfil` → `/admin/profile`)
- **Acciones:** cambiar email/contraseña, cerrar sesión, eliminar cuenta → Better-Auth.
- **Estado ui-cg:** tema real + prompts + cerrar sesión (vuelve al LockScreen) local. **TODO:** auth real.

### Antonella (chat/dock)
- **Backend:** `antonella.chat({message})`, `executeAction({actionName,actionInput})`, `notifications`, `listTools/getConfig/saveConfig`. Requiere `ANTHROPIC_API_KEY`.
- **Estado ui-cg:** respuestas mock (`CG.chat.replies`). **TODO:** cablear `antonella.chat`.

---

## 3. Orden sugerido para cablear escritura (cuando toque)
1. Infra: endpoints serverless de escritura (Opción A) con service-role.
2. Flujo operativo (mayor valor): `orders.create` (POS/Pedidos) → `updateOrderItemWeight` (Báscula) → `priceAndCharge` (Cobro) → `collections.addPayment` (Cobranza).
3. Catálogo: `products.*`, `customerPrices.bulkUpsert`, `paymentMethods.*`, `transactions.*`, `cold-inventory.*`.
4. Producción: `yields.*`, `products.processDisassembly`.
5. Recetas (opcional, alto esfuerzo): `inventory.recipes*`.

---

## Apéndice A — Contrato completo de la API tRPC

> Niveles: `protected` (autenticado), `almacen` (operación), `admin`. kg/dinero: ver §0.

### orders
- **get** (query) `{ id }` → pedido con cliente e items, o null.
- **list** (query) `void` → pedidos del usuario.
- **getPendingWeighingOrders** (query) `void` → pedidos por pesar.
- **getReadyToCharge** (query) `void` → pedidos `LISTA_PARA_COBRO` + `savedPriceKg`.
- **create** (mutation) `{ customerId, paymentMethodId?, items:[{productId,quantityPieces?,quantityKg?(gramos),unitPrice(centavos),requiresPurchase?}], notes?, deliveryAddress?, whatsappMessageId? }`.
- **update** (mutation) `{ id, total_amount?(centavos), status? }`.
- **replaceItems** (mutation) `{ orderId, customerId?, notes?, status?, items:[{productId?,productName,quantityPieces,quantityKg,unitPrice(pesos)}] }`.
- **delete** (mutation) `{ id }`.
- **updateOrderItemWeight** (mutation) `{ orderItemId, actualWeightKg:int(gramos) }`.
- **completeOrderPayment** (mutation) `{ orderId, paymentMethodId }`.
- **completeOrderOnCredit** (mutation) `{ orderId }`.
- **convertToCredit** (mutation) `{ orderId }`.
- **priceAndCharge** (mutation) `{ orderId, paymentType:"contado"|"credito", paymentMethodId?, items:[{orderItemId,productId|null,pricePerKg(pesos)}] }` → `{success,total(centavos)}`.
- **createProductionWeighing** (mutation) `{ productId, productName, pieces? }`.
- **validateDisassemblyRecipes / prepareDisassemblyForOrder** (mutation) `{ orderId, transformationType, canalProductId?, productsToLeaveWhole?[] }`.

### products
- **list** (query) `{ isParent?, parentProductId?, includeDescendants?, includeSelf? }`.
- **create/update** (mutation, admin) `{ name, price_per_kg?, price_per_piece?, stock_pieces?, stock_kg?, category?, is_parent_product?, is_sellable_by_unit?, is_sellable_by_weight?, default_sale_unit?, ... }` (update lleva `id`).
- **delete** (mutation, admin) `{ id }`.
- **processDisassembly** (mutation, almacen) `{ parentProductId, quantityToProcess, transformationType, entryMode?, realWeightMode? }`.
- **convertToVariant** (mutation, almacen) `{ baseProductId, variantProductId, pieces }`.
- **availabilityMap** (query) `void` → `[{productId,stockPieces,stockKg,derivable}]`.
- **getTransformations** (query) `{ parentProductId, transformationType? }`.
- **registerChannelPurchase** (mutation, almacen) `{ purchaseMode, qtyAmericano, qtyNacional, totalWeightKg, pricePerKg?, supplier? }`.
- **classifyOrphan** (mutation, admin) `{ productId, action:"purchased"|"duplicate" }`.

### yields
- **purchaseDates** (query) `void`; **purchasesByDate** (query) `{date}`; **latestPurchase** (query) `void`.
- **savePurchases** (mutation) `{ date, rows:[{supplier,canales,kg,precio,americano,nacional,verifCanales,verifKg}] }`.
- **despiecePanel** (query) `void`; **suggestDespiecePlan** (query) `void`; **canales** (query) `void`.
- **projectFromCanales** (query) `{ canales:[{canalProductId,numCanales}] }`.
- **list/byProvider** (query) `void`; **get** (query) `{id}`.
- **create/update** (mutation) `{ numCanales, kgComprado, supplier?, notes?, items:[{productName,pieces,kgTotal,weighed,sortOrder}] }` (update lleva `id`).
- **calibrateFromDay** (mutation) `{ date }`; **cierre** (query) `{date}`; **cedisDay** (query) `{date}`; **saveCedis** (mutation) `{rows:[...]}`.

### inventory
- **priceListsList** (query) `void`; **priceListItemsByList** (query) `{priceListId}`.
- **priceListImportCsv** (mutation, admin) `{ listCode, listName, csvText, priceIsPerKg }`.
- **recipesList** (query) `{ parentProductId?, transformationType?, includeInactive? }`.
- **recipesUpsert** (mutation, admin) `{ id?, parentProductId, childProductId, yieldQuantityPieces, yieldWeightRatio, transformationType, isActive?, childName? }`.
- **recipesQuickUpdate** (mutation, admin) `{ id, yieldQuantityPieces?, yieldWeightRatio?, isVariant? }`.
- **recipesSetActive** (mutation, admin) `{ id, isActive }`; **setRefWeight** (mutation, admin) `{ productId, kg }`.
- **recipesImport** (mutation, admin) `{ canales:[...], ramificaciones:[...] }`.
- **recordWeighingBatch** (mutation, almacen) `{ productId, piecesWeighed?, weightKg, applyToInventory?, notes? }`.
- **adjust** (mutation, almacen) `{ productId, deltaPieces?, deltaKg?, transactionType?, notes? }`.
- **status** (query) `{productId?}`; **transactions** (query) `{productId,limit?}`.
- **resetAllStock / resetCustomersAndOrders** (mutation, admin) `{ adminPassword }`.

### collections
- **listAccounts** (query) `void`; **getStatement** (query) `{customerId}`.
- **addCharge** (mutation) `{ customerId, amount(pesos), concept?, chargeDate?, source, orderId? }`.
- **addPayment** (mutation) `{ customerId, amount(pesos), method?, paymentDate?, notes? }`.
- **updateCharge/updatePayment** (mutation) `{ id, amount, ... }`; **deleteCharge/deletePayment** `{id}`.
- **setAccount** (mutation) `{ customerId, creditLimit, termsDays }`.

### customers
- **list** (query) `void`; **getDetail** (query) `{id}`.
- **create** (mutation) `{ name, email(REQ), contact_name?, phone?, whatsapp_phone?, address?, status?, price_list_id?, credit_limit?, terms_days? }`.
- **update** (mutation) `{ id, ...(email opcional) }`; **delete** `{id}`.

### customer-prices
- **getByCustomer** (query) `{customerId}` → precios efectivos (propio→lista→base).
- **bulkUpsert** (mutation) `{ customerId, items:[{productId,pricePerKg|null,pricePerPiece|null}] }`.

### cold-inventory
- **list** (query) `void`. **toFrozen/toFresh** (mutation) `{ productId, kg, pieces }`.

### transactions
- **list** (query) `void`. **create** (mutation) `{ description, amount(centavos,int), type:"income"|"expense", category?, status? }`. **update** `{id,...}`; **delete** `{id}`.

### dashboard
- **stats** (query) `void` → `{ totalRevenue, totalExpenses, totalProfit, revenueByCategory, expensesByCategory, cashFlow[], profitMargin[] }`.

### payment-methods
- **list** (query) `void`. **create** `{name}`; **update** `{id,name}`; **delete** `{id}`.

### purchase-orders
- **list** (query) `{ status? }`. **resolve** (mutation, almacen) `{ id }`.

### tickets
- **generateTicket** (query) `{ orderId }` → ticket no fiscal.

### antonella
- **chat** (mutation) `{ message, historyId? }`; **executeAction** (mutation) `{ actionName, actionInput }`.
- **notifications/listTools/getConfig** (query) `void`; **saveConfig** (mutation) `{ systemPrompt, disabledTools[], customTools[], model }`.

### cities
- **listByState** (query) `{ state_code(2) }`.

---

## Apéndice B — Equivalencia de claves de datos (mock CG.* ↔ Supabase)
Ya implementado en `api/cg-data.js`. Fuentes:
- `data.panel` ← orders + channel_purchases + order_items (categorías).
- `data.compra` ← channel_purchases.
- `data.despiece` ← products (canales padre) + product_transformations.
- `data.bascula` ← orders `PENDIENTE_PESAJE` + order_items.
- `data.cobro` ← orders `LISTA_PARA_COBRO` + order_items.
- `config.productos` ← products; `config.cold` ← products (fresco/frío);
  `config.payment` ← payment_methods; `config.precios` ← price_lists/price_list_items.
- `ops.clientes`/`ops.cobranza` ← customers + credit_charges/credit_payments.
- `ops.pedidos` ← orders + customers; `ops.pos` ← products + price_lists;
  `ops.rendimiento` ← yield_sheets/yield_sheet_items.
