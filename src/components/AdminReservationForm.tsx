import { useState } from "react";
import { format, addWeeks, parseISO } from "date-fns";
import { useScheduleBlocks } from "@/hooks/useScheduleBlocks";
import { useAdminProfiles } from "@/hooks/useProfiles";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Repeat } from "lucide-react";

const NO_TEACHER = "__none__";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AdminReservationForm({ open, onOpenChange }: Props) {
  const { data: blocks } = useScheduleBlocks();
  const { data: profiles } = useAdminProfiles();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [teacherId, setTeacherId] = useState<string>(NO_TEACHER);
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [blockStart, setBlockStart] = useState("1");
  const [blockEnd, setBlockEnd] = useState("1");
  const [courseName, setCourseName] = useState("");
  const [classObjective, setClassObjective] = useState("");
  const [observation, setObservation] = useState("");
  const [status, setStatus] = useState("approved");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const formatTime = (t: string) => t.slice(0, 5);

  const dates = (): string[] => {
    if (!isRecurring || !recurrenceEndDate) return [date];
    const start = parseISO(date);
    const end = parseISO(recurrenceEndDate);
    if (end < start) return [date];
    const out: string[] = [];
    let cur = start;
    while (cur <= end) {
      out.push(format(cur, "yyyy-MM-dd"));
      cur = addWeeks(cur, 1);
    }
    return out;
  };

  const reset = () => {
    setTeacherId(NO_TEACHER);
    setCourseName("");
    setClassObjective("");
    setObservation("");
    setStatus("approved");
    setIsRecurring(false);
    setRecurrenceEndDate("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseName.trim() || !classObjective.trim()) {
      toast({ title: "Faltan datos", description: "Curso y objetivo son obligatorios.", variant: "destructive" });
      return;
    }
    const all = dates();
    if (all.length > 60) {
      toast({ title: "Demasiadas fechas", description: "Máximo 60 ocurrencias.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const owner = teacherId === NO_TEACHER ? user!.id : teacherId;
      const groupId = all.length > 1 ? crypto.randomUUID() : null;
      const rows = all.map(d => ({
        teacher_id: owner,
        reservation_date: d,
        block_start: parseInt(blockStart),
        block_end: parseInt(blockEnd),
        course_name: courseName.trim(),
        class_objective: classObjective.trim(),
        status,
        recurrence_group_id: groupId,
      }));
      const { data, error } = await supabase.from("reservations").insert(rows).select("id");
      if (error) throw error;

      if (observation.trim() && data?.length) {
        const { error: notesError } = await supabase
          .from("reservation_notes")
          .upsert(
            data.map((r: any) => ({ reservation_id: r.id, observation: observation.trim() })),
            { onConflict: "reservation_id" }
          );
        if (notesError) throw notesError;
      }

      queryClient.invalidateQueries({ queryKey: ["reservations"] });
      queryClient.invalidateQueries({ queryKey: ["public_reservations"] });
      toast({
        title: "Reserva creada",
        description: all.length > 1 ? `Se crearon ${all.length} reservas.` : "La reserva fue registrada.",
      });
      onOpenChange(false);
      reset();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const previewCount = isRecurring && recurrenceEndDate ? dates().length : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva reserva (administrador)</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Docente</Label>
            <Select value={teacherId} onValueChange={setTeacherId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_TEACHER}>Sin docente asignado (uso administrativo)</SelectItem>
                {profiles?.map((p: any) => (
                  <SelectItem key={p.user_id} value={p.user_id}>
                    {p.full_name} — {p.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Puedes asignarla a un usuario registrado o dejarla como reserva administrativa.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Fecha</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Bloque inicio</Label>
              <Select value={blockStart} onValueChange={v => { setBlockStart(v); if (parseInt(v) > parseInt(blockEnd)) setBlockEnd(v); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {blocks?.map(b => (
                    <SelectItem key={b.block_number} value={b.block_number.toString()}>
                      Bloque {b.block_number} ({formatTime(b.start_time)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Bloque fin</Label>
              <Select value={blockEnd} onValueChange={setBlockEnd}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {blocks?.filter(b => b.block_number >= parseInt(blockStart)).map(b => (
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
            <Input value={courseName} onChange={e => setCourseName(e.target.value)} required maxLength={120} placeholder="Ej: 8°A - Tecnología" />
          </div>

          <div className="space-y-2">
            <Label>Objetivo de la clase</Label>
            <Textarea value={classObjective} onChange={e => setClassObjective(e.target.value)} required maxLength={500} rows={2} />
          </div>

          <div className="space-y-2">
            <Label>Estado</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="approved">Aprobada</SelectItem>
                <SelectItem value="pending">Pendiente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border border-border p-3 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={isRecurring} onCheckedChange={v => setIsRecurring(!!v)} />
              <Repeat className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-foreground">Repetir cada semana</span>
            </label>
            {isRecurring && (
              <div className="space-y-2 pl-6">
                <Label className="text-xs">Hasta</Label>
                <Input type="date" value={recurrenceEndDate} onChange={e => setRecurrenceEndDate(e.target.value)} min={date} required={isRecurring} />
                {previewCount > 1 && (
                  <p className="text-xs text-muted-foreground">Se crearán {previewCount} reservas.</p>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Observación (opcional)</Label>
            <Textarea value={observation} onChange={e => setObservation(e.target.value)} rows={2} maxLength={500} />
          </div>

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Guardando..." : "Crear reserva"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
