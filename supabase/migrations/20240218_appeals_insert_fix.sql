-- Migration 20240218: Fix appeals insert by safely adding 'pending' to reail_review_status enum
-- FULLY IDEMPOTENT: safe to re-run on any environment

-- 1) Create the enum type if it doesn't exist
DO $$ BEGIN
  CREATE TYPE reail_review_status AS ENUM ('pending', 'reviewing', 'accepted', 'rejected', 'closed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2) Safely add 'pending' value to enum if it exists but 'pending' is missing
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reail_review_status') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum
      WHERE enumtypid = 'reail_review_status'::regtype
        AND enumlabel = 'pending'
    ) THEN
      ALTER TYPE reail_review_status ADD VALUE 'pending' BEFORE 'reviewing';
    END IF;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN invalid_parameter_value THEN NULL;
END $$;

-- 3) Safely add other enum values if missing
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reail_review_status') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum
      WHERE enumtypid = 'reail_review_status'::regtype
        AND enumlabel = 'reviewing'
    ) THEN
      ALTER TYPE reail_review_status ADD VALUE 'reviewing';
    END IF;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN invalid_parameter_value THEN NULL;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reail_review_status') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum
      WHERE enumtypid = 'reail_review_status'::regtype
        AND enumlabel = 'accepted'
    ) THEN
      ALTER TYPE reail_review_status ADD VALUE 'accepted';
    END IF;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN invalid_parameter_value THEN NULL;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reail_review_status') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum
      WHERE enumtypid = 'reail_review_status'::regtype
        AND enumlabel = 'rejected'
    ) THEN
      ALTER TYPE reail_review_status ADD VALUE 'rejected';
    END IF;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN invalid_parameter_value THEN NULL;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reail_review_status') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum
      WHERE enumtypid = 'reail_review_status'::regtype
        AND enumlabel = 'closed'
    ) THEN
      ALTER TYPE reail_review_status ADD VALUE 'closed';
    END IF;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN invalid_parameter_value THEN NULL;
END $$;

-- 4) Update appeals table to use enum type if it's still using TEXT
-- Only do this if the column exists and is TEXT type
DO $$ 
DECLARE
  col_type TEXT;
BEGIN
  SELECT data_type INTO col_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'appeals'
    AND column_name = 'status';
  
  IF col_type = 'text' OR col_type = 'character varying' THEN
    -- First drop the CHECK constraint if it exists
    ALTER TABLE public.appeals DROP CONSTRAINT IF EXISTS appeals_status_check;
    
    -- Convert column to enum
    ALTER TABLE public.appeals
      ALTER COLUMN status DROP DEFAULT,
      ALTER COLUMN status TYPE reail_review_status USING status::reail_review_status,
      ALTER COLUMN status SET DEFAULT 'pending'::reail_review_status;
  END IF;
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN invalid_text_representation THEN
    RAISE NOTICE 'Could not convert existing status values to enum';
END $$;

-- 5) Ensure default is set correctly for new inserts
DO $$ BEGIN
  ALTER TABLE public.appeals ALTER COLUMN status SET DEFAULT 'pending'::reail_review_status;
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN invalid_parameter_value THEN NULL;
END $$;
