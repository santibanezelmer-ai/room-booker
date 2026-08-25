import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Mail, Plus, Trash2 } from "lucide-react";
import {
  useNotificationSettings,
  useUpdateNotificationSettings,
  useNotificationLog,
} from "@/hooks/useNotificationSettings";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

const EVENTS: { key: "notify_new_request" | "notify_approved" | "notify_rejected" | "notify_released"; label: string; desc: string }[] = [
  { key: "notify_new_request", label: "Nueva solicitud", desc: "Avisa a los administradores cuando un docente solicita la sala." },
  { key: "notify_approved", label: "Reserva aprobada", desc: "Avisa al docente cuando su reserva es aprobada." },
  { key: "notify_rejected", label: "Reserva rechazada", desc: "Avisa al docente, incluyendo el motivo del rechazo." },
  { key: "notify_released", label: "Reserva liberada", desc: "Avisa al docente cuando el administrador libera su bloque." },
];

const EVENT_LABEL: Record<string, string> = {
  new_request: "Nueva solicitud",
  approved: "Aprobada",
  rejected: "Rechazada",
  released: "Liberada",
};

export default function NotificationSettingsPanel() {
  const { data: settings, isLoading } = useNotificationSettings();
  const update = useUpdateNotificationSettings();
  const { data: log } = useNotificationLog();
  const { toast } = useToast();

  const [emails, setEmails] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState("");

  useEffect(() => {
    if (settings?.admin_emails) setEmails(settings.admin_emails);
  }, [settings?.admin_emails]);

  const toggle = (key: string, value: boolean) => {
    update.mutate(
      { [key]: value } as any,
      { onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }) }
    );
  };

  const addEmail = () => {
    const value = newEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      toast({ title: "Correo inválido", description: "Escribe una dirección válida.", variant: "destructive" });
      return;
    }
    if (emails.includes(value)) return;
    const next = [...emails, value];
    setEmails(next);
    setNewEmail("");
    update.mutate({ admin_emails: next }, {
      onSuccess: () => toast({ title: "Correo agregado" }),
      onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
    });
  };

  const removeEmail = (email: string) => {
    const next = emails.filter(e => e !== email);
    setEmails(next);
    update.mutate({ admin_emails: next });
  };

  if (isLoading) return <Card><CardContent className="py-12 text-center text-muted-foreground">Cargando…</CardContent></Card>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4" /> Avisos automáticos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {EVENTS.map(ev => (
            <div key={ev.key} className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-foreground">{ev.label}</p>
                <p className="text-xs text-muted-foreground">{ev.desc}</p>
              </div>
              <Switch
                checked={!!settings?.[ev.key]}
                onCheckedChange={(v) => toggle(ev.key, v)}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Correos que reciben las solicitudes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <Label className="sr-only">Correo</Label>
              <Input
                type="email"
                value={newEmail}
                placeholder="coordinacion@colegio.cl"
                onChange={e => setNewEmail(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addEmail(); } }}
              />
            </div>
            <Button onClick={addEmail} size="sm"><Plus className="h-4 w-4 mr-1" />Agregar</Button>
          </div>
          {emails.length === 0 ? (
            <p className="text-xs text-muted-foreground">Aún no hay correos configurados; los avisos de nuevas solicitudes no se enviarán.</p>
          ) : (
            <div className="space-y-2">
              {emails.map(email => (
                <div key={email} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <span className="text-sm text-foreground">{email}</span>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeEmail(email)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Últimos envíos</CardTitle>
        </CardHeader>
        <CardContent>
          {!log?.length ? (
            <p className="text-sm text-muted-foreground">Todavía no se ha enviado ningún aviso.</p>
          ) : (
            <div className="space-y-2">
              {log.map((row: any) => (
                <div key={row.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{row.recipient_email}</p>
                    <p className="text-xs text-muted-foreground">
                      {EVENT_LABEL[row.event_type] ?? row.event_type} · {format(parseISO(row.created_at), "d MMM HH:mm", { locale: es })}
                      {row.error_message ? ` · ${row.error_message}` : ""}
                    </p>
                  </div>
                  <Badge variant={row.status === "sent" ? "default" : "destructive"}>
                    {row.status === "sent" ? "Enviado" : "Falló"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
