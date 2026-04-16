
ALTER TABLE public.schedule_blocks ADD COLUMN available_days integer[] NOT NULL DEFAULT ARRAY[1,2,3,4,5];

UPDATE public.schedule_blocks SET available_days = ARRAY[1,2,3,4] WHERE block_number IN (7, 8);
