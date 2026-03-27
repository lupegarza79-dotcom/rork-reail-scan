-- Migration 20240211: placeholder (no-op)
-- This migration exists to maintain version continuity between
-- 20240210_money_cases.sql and 20240212_trust_graph.sql.
-- Required so that fresh clones do not fail with
-- "remote migration versions not found in local migrations directory".
-- No schema changes.
SELECT 1;
