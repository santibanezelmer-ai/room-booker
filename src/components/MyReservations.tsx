import { useReservations } from "@/hooks/useReservations";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Clock, BookOpen, MessageSquare } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  pending: { label: "Pendiente", className: "bg-status-pending text-status-pending-foreground" },
  approved: { label: "Aprobada", className: "bg-status-approved text-status-approved-foreground" },
  rejected: { label: "Rechazada", className: "bg-status-rejected text-status-rejected-foreground" },
};

export default function MyReservations() {
  const { data: reservations, isLoading } = useReservations();

  if (isLoading) return <div className="space-y-3">{Array.from({length: 3}).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>;

  if (!reservations?.length) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No tienes solicitudes de reserva aún.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {reservations.map((r) => {
        const status = STATUS_MAP[r.status] || STATUS_MAP.pending;
        return (
          <Card key={r.id} className="animate-fade-in">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-foreground">{r.course_name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    {format(new Date(r.reservation_date + "T12:00:00"), "EEEE d 'de' MMMM", { locale: es })} — Bloque {r.block_start}{r.block_end > r.block_start ? ` a ${r.block_end}` : ""}
                  </div>
                  {r.observation && (
                    <div className="flex items-start gap-2 text-sm text-muted-foreground">
                      <MessageSquare className="h-3.5 w-3.5 mt-0.5" />
                      {r.observation}
                    </div>
                  )}
                  {r.admin_notes && r.status === "rejected" && (
                    <p className="text-sm text-destructive mt-1">Motivo: {r.admin_notes}</p>
                  )}
                </div>
                <Badge className={status.className}>{status.label}</Badge>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
