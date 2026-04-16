
CREATE TABLE public.schedule_blocks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  block_number integer NOT NULL UNIQUE,
  start_time time NOT NULL,
  end_time time NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.schedule_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view blocks" ON public.schedule_blocks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage blocks" ON public.schedule_blocks FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.schedule_blocks (block_number, start_time, end_time) VALUES
  (1, '08:30', '09:15'),
  (2, '09:15', '10:00'),
  (3, '10:20', '11:05'),
  (4, '11:05', '11:50'),
  (5, '12:10', '12:50'),
  (6, '12:50', '13:30'),
  (7, '14:00', '14:45'),
  (8, '14:45', '15:30');
