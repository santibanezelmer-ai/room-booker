import { useState, useEffect } from "react";
import {
  useReservations,
  useUpdateOwnReservation,
  useDeleteOwnReservation,
} from "@/hooks/useReservations";
import { useScheduleBlocks } from "@/hooks/useScheduleBlocks";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Clock,
  BookOpen,
  MessageSquare,
  CalendarDays,
  Pencil,
  Trash2,
  Repeat,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  pending: { label: "Pendiente", className: "bg-status-pending text-status-pending-foreground" },
  approved: { label: "Aprobada", className: "bg-status-approved text-status-approved-foreground" },
  rejected: { label: "Rechazada", className: "bg-status-rejected text-status-rejected-foreground" },
  cancelled_by_admin: { label: "Liberada por admin", className: "bg-muted text-muted-foreground" },
};

export default function MyReservations() {
  const { data: reservations, isLoading } = useReservations();
  const { data: blocks } = useScheduleBlocks();
  const updateMine = useUpdateOwnReservation();
  const deleteMine = useDeleteOwnReservation();
  const { toast } = useToast();

  const [editing, setEditing] = useState<any>(null);
  const [editDate, setEditDate] = useState("");
  const [editBlockStart, setEditBlockStart] = useState("1");
  const [editBlockEnd, setEditBlockEnd] = useState("1");
  const [editCourse, setEditCourse] = useState("");
  const [editObs, setEditObs] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (editing) {
      setEditDate(editing.reservation_date);
      setEditBlockStart(editing.block_start.toString());
      setEditBlockEnd(editing.block_end.toString());
      setEditCourse(editing.course_name);
      setEditObs(editing.observation || "");
    }
  }, [editing]);

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateMine.mutateAsync({
        id: editing.id,
        updates: {
          reservation_date: editDate,
          block_start: parseInt(editBlockStart),
          block_end: parseInt(editBlockEnd),
          course_name: editCourse,
          observation: editObs || null,
        },
      });
      toast({ title: "Reserva actualizada" });
      setEditing(null);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteMine.mutateAsync(deletingId);
      toast({ title: "Reserva cancelada" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading)
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    );

  if (!reservations?.length) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-16 text-center">
          <CalendarDays className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">No tienes solicitudes de reserva aún</p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Haz clic en un bloque disponible en el horario para crear una
          </p>
        </CardContent>
      </Card>
    );
  }

  const sorted = [...reservations].sort((a: any, b: any) =>
    b.reservation_date.localeCompare(a.reservation_date)
  );

  const formatTime = (t: string) => t.slice(0, 5);

  return (
    <>
      <div className="space-y-3">
        {sorted.map((r: any) => {
          const status = STATUS_MAP[r.status] || STATUS_MAP.pending;
          const isPending = r.status === "pending";
          return (
            <Card key={r.id} className="animate-fade-in hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <BookOpen className="h-4 w-4 text-primary shrink-0" />
                      <span className="font-semibold text-foreground">{r.course_name}</span>
                      <Badge className={`${status.className} text-[11px] px-2 py-0`}>
                        {status.label}
                      </Badge>
                      {r.recurrence_group_id && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1">
                          <Repeat className="h-3 w-3" /> Recurrente
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        {format(new Date(r.reservation_date + "T12:00:00"), "EEEE d 'de' MMMM", {
                          locale: es,
                        })}{" "}
                        — Bloque {r.block_start}
                        {r.block_end > r.block_start ? ` a ${r.block_end}` : ""}
                      </span>
                    </div>
                    {r.observation && (
                      <div className="flex items-start gap-2 text-sm text-muted-foreground">
                        <MessageSquare className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        <span>{r.observation}</span>
                      </div>
                    )}
                    {r.admin_notes && r.status === "rejected" && (
                      <p className="text-sm text-destructive mt-1 bg-destructive/5 rounded-md px-2.5 py-1.5">
                        Motivo: {r.admin_notes}
                      </p>
                    )}
                    {r.status === "cancelled_by_admin" && r.cancellation_reason && (
                      <p className="text-sm text-muted-foreground mt-1 bg-muted/40 rounded-md px-2.5 py-1.5">
                        Liberada por admin: {r.cancellation_reason}
                      </p>
                    )}
                  </div>
                  {isPending && (
                    <div className="flex flex-col sm:flex-row gap-1.5 shrink-0">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setEditing(r)}
                        title="Editar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 text-destructive border-destructive/40 hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => setDeletingId(r.id)}
                        title="Cancelar"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Reserva</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div className="space-y-2">
              <Label>Fecha</Label>
              <Input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Bloque inicio</Label>
                <Select
                  value={editBlockStart}
                  onValueChange={(v) => {
                    setEditBlockStart(v);
                    if (parseInt(v) > parseInt(editBlockEnd)) setEditBlockEnd(v);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {blocks?.map((b) => (
                      <SelectItem key={b.block_number} value={b.block_number.toString()}>
                        Bloque {b.block_number} ({formatTime(b.start_time)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Bloque fin</Label>
                <Select value={editBlockEnd} onValueChange={setEditBlockEnd}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {blocks
                      ?.filter((b) => b.block_number >= parseInt(editBlockStart))
                      .map((b) => (
                        <SelectItem key={b.block_number} value={b.block_number.toString()}>
                          Bloque {b.block_number} ({formatTime(b.end_time)})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Asignatura / Curso</Label>
              <Input
                value={editCourse}
                onChange={(e) => setEditCourse(e.target.value)}
                required
                maxLength={120}
              />
            </div>
            <div className="space-y-2">
              <Label>Observación (opcional)</Label>
              <Textarea
                value={editObs}
                onChange={(e) => setEditObs(e.target.value)}
                rows={3}
                maxLength={500}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={updateMine.isPending}>
                {updateMine.isPending ? "Guardando..." : "Guardar cambios"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar esta reserva?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará la solicitud y no se podrá deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sí, cancelar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
