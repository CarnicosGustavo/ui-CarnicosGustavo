-- ============================================================================
-- Validación de saldos legacy (MyBusinessPOS → crédito)
-- Fecha: 2026-06-15
--
-- Agrega el estado de "validado" al SNAPSHOT legacy (public.credit_balances).
-- La pantalla Configuración → Validación de saldos usa estas columnas para
-- saber qué saldos ya se promovieron al sistema de crédito y por quién/cuándo.
--
-- Requisito: credit_balances debe ser una TABLA base (no una VIEW). Si es una
-- vista, este ALTER falla; en ese caso avísame y cambiamos a una tabla aparte
-- (staging.legacy_credit_validations) sin tocar credit_balances.
-- ============================================================================

alter table public.credit_balances
  add column if not exists validated_at timestamptz,
  add column if not exists validated_by text;

comment on column public.credit_balances.validated_at is
  'Saldo legacy validado y promovido a crédito (NULL = pendiente).';
comment on column public.credit_balances.validated_by is
  'Usuario que validó el saldo legacy.';
