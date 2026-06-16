# Contrato — Validación de saldos legacy (MBPOS → crédito)

Pantalla `cg-validacion-saldos.jsx` → cliente `cg-validacion-data.jsx` → endpoint
`api/validacion.js` → **vistas + RPC en Supabase**.

La pantalla NO toca la BD directamente. Todo el contrato vive en las vistas
`public.v_validacion_saldos` / `public.v_validacion_docs` y el RPC
`validar_saldo_legacy`. Si los nombres de columna no coinciden, la pantalla
saldrá vacía o con campos en blanco aunque la BD tenga los datos.

## Verificación rápida (SQL editor de Supabase)

```sql
-- 1) ¿existen las vistas?
select table_name
from information_schema.views
where table_schema = 'public'
  and table_name in ('v_validacion_saldos', 'v_validacion_docs');

-- 2) ¿columnas correctas?
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name in ('v_validacion_saldos', 'v_validacion_docs')
order by table_name, ordinal_position;

-- 3) ¿existe el RPC con esa firma?
select p.proname, pg_get_function_identity_arguments(p.oid) as args
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where p.proname = 'validar_saldo_legacy';
```

## `v_validacion_saldos` — una fila por cliente legacy

Consumida en `api/validacion.js` (`db.from("v_validacion_saldos").select("*")`):

| Columna        | Tipo      | Uso en la pantalla                          |
|----------------|-----------|---------------------------------------------|
| `id`           | text      | Código MBPOS mostrado (`MBPOS:{id}`)         |
| `customer_id`  | integer   | FK real; se pasa al RPC al validar           |
| `nombre`       | text      | Nombre del cliente                           |
| `saldo`        | numeric   | Saldo anterior total (pesos)                 |
| `limite`       | numeric   | Límite de crédito                            |
| `dias`         | integer   | Plazo en días                                |
| `ndoc`         | integer   | Nº de documentos                             |
| `validado`     | boolean   | true = ya promovido a crédito                |
| `validado_por` | text      | Usuario que validó (solo si `validado`)      |
| `validado_at`  | timestamp | Fecha de validación (solo si `validado`)     |

> `saldoActual` no se expone: la pantalla usa `saldo` como respaldo (sin bug).

## `v_validacion_docs` — una fila por documento (cargo/abono)

Consumida en `api/validacion.js` (`db.from("v_validacion_docs").select("*")`),
agrupada por `customer_id`:

| Columna       | Tipo    | Uso                                            |
|---------------|---------|------------------------------------------------|
| `customer_id` | integer | Agrupa documentos por cliente                  |
| `fecha`       | date    | Fecha del documento                            |
| `venc`        | date    | Vencimiento                                    |
| `tipo`        | text    | "FAC" / "NC" (etiqueta)                         |
| `ref`         | text    | Referencia (folio)                             |
| `importe`     | numeric | Importe (negativo = NC/abono)                  |
| `saldo`       | numeric | Saldo del documento                            |
| `obs`         | text    | Observación                                    |

> El **estado** del documento (Vencido/Parcial/Aplicado/Pendiente) NO viene de la
> vista: lo deriva `docEstado(importe, saldo, venc)` en `api/validacion.js`.

## RPC `validar_saldo_legacy`

Invocado en POST `/api/validacion` (`db.rpc("validar_saldo_legacy", {...})`):

```
validar_saldo_legacy(p_customer_id integer, p_usuario text) returns ...
```

Debe ser atómico: crear/actualizar la cuenta de crédito, sembrar el saldo inicial
como cargo, y marcar el registro legacy como validado (con usuario y fecha).

## Estado de la verificación
- ✅ Contrato JS (endpoint ↔ pantalla): auditado, los campos coinciden.
- ⏳ Vistas/RPC en Supabase: **pendiente de verificar** (correr el SQL de arriba).
  Si falta alguna, la pantalla muestra "Cargando…" → vacío.
