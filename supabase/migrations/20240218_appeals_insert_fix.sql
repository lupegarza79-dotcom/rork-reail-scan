-- Migration 20240218: fix enum 'pending' safely (NO usage in same transaction)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reail_review_status') THEN
    BEGIN
      ALTER TYPE reail_review_status ADD VALUE 'pending';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;
