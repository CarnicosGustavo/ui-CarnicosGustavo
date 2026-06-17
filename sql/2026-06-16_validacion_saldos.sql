-- ============================================================================
-- Validación de saldos legacy (MBPOS 2022 → crédito)  ·  migración reproducible
-- ----------------------------------------------------------------------------
-- Objetos que sostienen el contrato de docs/CONTRATO_VALIDACION_SALDOS.md:
--   · vistas  public.v_validacion_saldos / public.v_validacion_docs   (lectura)
--   · RPC     public.validar_saldo_legacy(integer, text)              (acción)
--
-- Dependen de las tablas de staging (cargadas por el import legacy 2022; los
-- DATOS no son parte de esta migración, solo la estructura para reproducir).
--
-- FIX (2026-06-16): antes, public.validar_saldo_legacy era un STUB que solo
-- marcaba validado=true y NO creaba la cuenta de crédito ni el cargo de saldo
-- inicial. La app llama a `public` vía PostgREST, así que "Validar" no movía el
-- saldo a cobranza. Aquí public DELEGA en la lógica real de staging (idempotente).
-- ============================================================================

create schema if not exists staging;

-- ---- Tablas de staging (estructura; datos = import legacy) ------------------
create table if not exists staging.legacy_credit_clientes (
  customer_id   integer,
  legacy_cliente text,
  legacy_int    bigint,
  nombre        text,
  saldo_2022    numeric,
  limite_credito bigint,
  dias_credito  bigint,
  n_documentos  bigint,
  validado      boolean,
  validado_at   timestamptz,
  validado_por  text,
  fuente        text,
  importado     boolean,
  importado_at  timestamptz,
  importado_por text
);

create table if not exists staging.legacy_credit_documentos (
  customer_id    integer,
  legacy_cliente text,
  nombre         text,
  doc_id         bigint,
  "TIPO_DOC"     text,
  "NO_REFEREN"   bigint,
  fecha          date,
  fecha_venc     date,
  importe        numeric,
  saldo          numeric,
  "MONEDA"       text,
  "ESTADO"       text,
  "OBSERV"       text,
  "VENTA"        bigint
);

-- ---- Vistas (consumidas por api/validacion.js) -----------------------------
create or replace view public.v_validacion_saldos as
  select legacy_cliente as id,
         customer_id,
         nombre,
         coalesce(saldo_2022, 0::numeric)    as saldo,
         coalesce(limite_credito, 0::bigint) as limite,
         coalesce(dias_credito, 0::bigint)   as dias,
         coalesce(n_documentos, 0::bigint)   as ndoc,
         coalesce(validado, false)           as validado,
         validado_at,
         validado_por,
         coalesce(importado, false)          as importado,
         importado_at
    from staging.legacy_credit_clientes c;

create or replace view public.v_validacion_docs as
  select customer_id,
         legacy_cliente,
         fecha,
         fecha_venc   as venc,
         "TIPO_DOC"   as tipo,
         "NO_REFEREN" as ref,
         importe,
         saldo,
         "ESTADO"     as estado_raw,
         "OBSERV"     as obs
    from staging.legacy_credit_documentos d;

-- ---- Lógica real (atómica, idempotente) ------------------------------------
-- Crea/actualiza la cuenta de crédito, siembra el cargo de saldo inicial (una
-- sola vez por cliente) y marca el registro legacy como validado.
create or replace function staging.validar_saldo_legacy(p_customer_id integer, p_usuario text default 'sistema')
returns text
language plpgsql
as $function$
declare
  v_saldo numeric;
  v_limite numeric;
  v_dias integer;
  v_validado boolean;
  v_fecha date;
  v_charge_id integer;
begin
  select saldo_2022, coalesce(limite_credito,0), coalesce(dias_credito,0), validado
    into v_saldo, v_limite, v_dias, v_validado
  from staging.legacy_credit_clientes
  where customer_id = p_customer_id;

  if not found then
    return 'ERROR: no existe registro legacy para customer_id '||p_customer_id;
  end if;
  if v_validado then
    return 'AVISO: customer_id '||p_customer_id||' ya estaba validado (sin cambios)';
  end if;

  -- 1) Asegurar cuenta de crédito (límite y plazo del sistema viejo)
  if exists (select 1 from credit_accounts where customer_id = p_customer_id) then
    update credit_accounts
       set credit_limit = v_limite, terms_days = v_dias, updated_at = now()
     where customer_id = p_customer_id;
  else
    insert into credit_accounts (customer_id, credit_limit, terms_days)
    values (p_customer_id, v_limite, v_dias);
  end if;

  -- 2) Cargo de saldo inicial (idempotente: no duplica si ya existe)
  v_fecha := coalesce((select max(fecha) from staging.legacy_credit_documentos where customer_id = p_customer_id), date '2022-06-30');
  if v_saldo > 0 and not exists (
        select 1 from credit_charges
        where customer_id = p_customer_id and concept = 'Saldo inicial MBPOS 2022') then
    insert into credit_charges (customer_id, amount, concept, charge_date, source)
    values (p_customer_id, v_saldo, 'Saldo inicial MBPOS 2022', v_fecha, 'ticket_viejo')
    returning id into v_charge_id;
  end if;

  -- 3) Marcar como validado
  update staging.legacy_credit_clientes
     set validado = true, validado_at = now(), validado_por = p_usuario
   where customer_id = p_customer_id;

  return 'OK: customer_id '||p_customer_id||' validado. Saldo $'||v_saldo||' cargado (cargo id '||coalesce(v_charge_id::text,'sin cargo')||').';
end;
$function$;

-- ---- RPC público (lo que llama la app vía PostgREST) -----------------------
-- DELEGA en staging (single source of truth). SECURITY DEFINER para que la
-- service-role pueda ejecutar la lógica que toca credit_accounts/credit_charges.
create or replace function public.validar_saldo_legacy(p_customer_id integer, p_usuario text default null)
returns boolean
language plpgsql
security definer
set search_path to 'staging', 'public'
as $function$
begin
  perform staging.validar_saldo_legacy(p_customer_id, coalesce(p_usuario, 'sistema'));
  return true;
end;
$function$;

-- ---- Verificación (correr en el SQL editor) --------------------------------
-- select table_name from information_schema.views
--  where table_schema='public' and table_name in ('v_validacion_saldos','v_validacion_docs');
-- select proname, pg_get_function_identity_arguments(oid)
--   from pg_proc where proname='validar_saldo_legacy';
-- select count(*) total, count(*) filter (where saldo>0) con_saldo from public.v_validacion_saldos;
