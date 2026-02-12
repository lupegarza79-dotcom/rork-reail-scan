-- Fix telemetry inserts when function_name is missing/blank
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema='public'
      AND table_name='scan_telemetry_events'
      AND column_name='function_name'
  ) THEN
    EXECUTE $$ALTER TABLE public.scan_telemetry_events
              ALTER COLUMN function_name SET DEFAULT 'unknown'$$;

    EXECUTE $$UPDATE public.scan_telemetry_events
              SET function_name='unknown'
              WHERE function_name IS NULL OR function_name = ''$$;
  END IF;
END $$;