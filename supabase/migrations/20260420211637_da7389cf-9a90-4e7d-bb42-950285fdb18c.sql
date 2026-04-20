-- Add class objective field to reservations
ALTER TABLE public.reservations
ADD COLUMN class_objective text;

-- Backfill existing rows so the new NOT NULL constraint applies cleanly to new rows.
UPDATE public.reservations SET class_objective = COALESCE(observation, '—') WHERE class_objective IS NULL;

ALTER TABLE public.reservations
ALTER COLUMN class_objective SET NOT NULL;