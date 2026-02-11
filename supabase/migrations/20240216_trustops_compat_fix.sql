-- TrustOps compatibility fix-forward migration (idempotent)
-- Handles environments where manual SQL created tables without device_id.

ALTER TABLE IF EXISTS public.appeals
  ADD COLUMN IF NOT EXISTS device_id text;

CREATE INDEX IF NOT EXISTS idx_appeals_device
  ON public.appeals(device_id);

ALTER TABLE IF EXISTS public.claims
  ADD COLUMN IF NOT EXISTS device_id text;

CREATE INDEX IF NOT EXISTS idx_claims_device
  ON public.claims(device_id);
