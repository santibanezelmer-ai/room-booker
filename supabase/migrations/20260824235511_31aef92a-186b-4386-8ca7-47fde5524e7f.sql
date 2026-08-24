CREATE TABLE public.notification_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notify_new_request boolean NOT NULL DEFAULT true,
  notify_approved boolean NOT NULL DEFAULT true,
  notify_rejected boolean NOT NULL DEFAULT true,
  notify_released boolean NOT NULL DEFAULT true,
  admin_emails text[] NOT NULL DEFAULT ARRAY[]::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.notification_settings TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.notification_settings TO authenticated;
GRANT ALL ON public.notification_settings TO service_role;

ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view notification settings"
ON public.notification_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage notification settings"
ON public.notification_settings FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER update_notification_settings_updated_at
BEFORE UPDATE ON public.notification_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.notification_settings DEFAULT VALUES;

CREATE TABLE public.notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid,
  recurrence_group_id uuid,
  event_type text NOT NULL,
  recipient_email text NOT NULL,
  status text NOT NULL DEFAULT 'sent',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notification_log_reservation ON public.notification_log (reservation_id, event_type);
CREATE INDEX idx_notification_log_created_at ON public.notification_log (created_at DESC);

GRANT SELECT ON public.notification_log TO authenticated;
GRANT ALL ON public.notification_log TO service_role;

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view notification log"
ON public.notification_log FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));