import { useState, useEffect } from "react";
import { format, addWeeks, parseISO, getISODay } from "date-fns";
import { useScheduleBlocks } from "@/hooks/useScheduleBlocks";
import { useCreateReservation, useCreateRecurringReservations } from "@/hooks/useReservations";
import { useMaterials } from "@/hooks/useMaterials";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { Repeat } from "lucide-react";

interface ReservationFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedDate?: string;
  preselectedBlock?: number;
}

export default function ReservationForm({ open, onOpenChange, preselectedDate, preselectedBlock }: ReservationFormProps) {
  const { data: blocks } = useScheduleBlocks();
  const { data: materials } = useMaterials();
  const createReservation = useCreateReservation();
  const createRecurring = useCreateRecurringReservations();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [date, setDate] = useState(preselectedDate || format(new Date(), "yyyy-MM-dd"));
  const [blockStart, setBlockStart] = useState(preselectedBlock?.toString() || "1");
  const [blockEnd, setBlockEnd] = useState(preselectedBlock?.toString() || "1");
  const [courseName, setCourseName] = useState("");
  const [classObjective, setClassObjective] = useState("");
  const [observation, setObservation] = useState("");
  const [selectedMaterials, setSelectedMaterials] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  // Recurrence
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState("");

  useEffect(() => {
    if (preselectedDate) setDate(preselectedDate);
    if (preselectedBlock) {
      setBlockStart(preselectedBlock.toString());
      setBlockEnd(preselectedBlock.toString());
    }
  }, [preselectedDate, preselectedBlock]);

  const formatTime = (t: string) => t.slice(0, 5);

  const toggleMaterial = (materialId: string) => {
    setSelectedMaterials(prev => {
      const next = { ...prev };
      if (next[materialId]) delete next[materialId];
      else next[materialId] = 1;
      return next;
    });
  };

  const setMaterialQty = (materialId: string, qty: number) => {
    setSelectedMaterials(prev => ({ ...prev, [materialId]: qty }));
  };

  // Compute recurrence dates: same weekday, weekly, until end date inclusive.
  const recurrenceDates = (): string[] => {
    if (!isRecurring || !recurrenceEndDate) return [date];
    const start = parseISO(date);
    const end = parseISO(recurrenceEndDate);
    if (end < start) return [date];
    const dates: string[] = [];
    let cur = start;
    while (cur <= end) {
      dates.push(format(cur, "yyyy-MM-dd"));
      cur = addWeeks(cur, 1);
    }
    return dates;
  };

  // Validate that all recurrence dates fall on a day where the chosen blocks are available.
  const validateRecurrence = (dates: string[]): string | null => {
    if (!blocks) return null;
    const bs = parseInt(blockStart);
    const be = parseInt(blockEnd);
    const blocksInRange = blocks.filter(b => b.block_number >= bs && b.block_number <= be);
    for (const d of dates) {
      const dow = getISODay(parseISO(d));
      for (const b of blocksInRange) {
        if (!(b.available_days?.includes(dow) ?? true)) {
          return `El bloque ${b.block_number} no está disponible los ${format(parseISO(d), "EEEE")}.`;
        }
      }
    }
    return null;
  };

  const resetForm = () => {
    setCourseName("");
    setClassObjective("");
    setObservation("");
    setSelectedMaterials({});
    setIsRecurring(false);
    setRecurrenceEndDate("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (courseName.trim().length === 0 || courseName.length > 120) {
      toast({ title: "Curso inválido", description: "Máximo 120 caracteres.", variant: "destructive" });
      return;
    }
    if (classObjective.trim().length === 0) {
      toast({ title: "Objetivo requerido", description: "Debes registrar el objetivo de la clase.", variant: "destructive" });
      return;
    }
    if (classObjective.length > 500) {
      toast({ title: "Objetivo muy largo", description: "Máximo 500 caracteres.", variant: "destructive" });
      return;
    }
    if (observation.length > 500) {
      toast({ title: "Observación muy larga", description: "Máximo 500 caracteres.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const dates = recurrenceDates();

      if (isRecurring && dates.length > 1) {
        const err = validateRecurrence(dates);
        if (err) {
          toast({ title: "No se puede crear", description: err, variant: "destructive" });
          setSubmitting(false);
          return;
        }
        if (dates.length > 52) {
          toast({ title: "Demasiadas fechas", description: "Máximo 52 ocurrencias.", variant: "destructive" });
          setSubmitting(false);
          return;
        }
        await createRecurring.mutateAsync({
          dates,
          block_start: parseInt(blockStart),
          block_end: parseInt(blockEnd),
          course_name: courseName.trim(),
          class_objective: classObjective.trim(),
          observation: observation || undefined,
        });
        toast({
          title: "Solicitudes recurrentes enviadas",
          description: `Se crearon ${dates.length} reservas pendientes.`,
        });
      } else {
        await createReservation.mutateAsync({
          reservation_date: date,
          block_start: parseInt(blockStart),
          block_end: parseInt(blockEnd),
          course_name: courseName.trim(),
          class_objective: classObjective.trim(),
          observation: observation || undefined,
        });

        const matEntries = Object.entries(selectedMaterials);
        if (matEntries.length > 0) {
          const matReservations = matEntries.map(([material_id, quantity]) => ({
            reservation_date: date,
            block_start: parseInt(blockStart),
            block_end: parseInt(blockEnd),
            course_name: courseName.trim(),
            material_id,
            quantity,
            teacher_id: user!.id,
            observation: observation || null,
          }));
          const { error } = await supabase.from("material_reservations").insert(matReservations);
          if (error) throw error;
          queryClient.invalidateQueries({ queryKey: ["material_reservations"] });
        }

        toast({ title: "Solicitud enviada", description: "Tu reserva está pendiente de aprobación." });
      }

      onOpenChange(false);
      resetForm();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const previewCount = isRecurring && recurrenceEndDate ? recurrenceDates().length : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva Solicitud de Reserva</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
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
            <Input
              value={courseName}
              onChange={e => setCourseName(e.target.value)}
              required
              maxLength={120}
              placeholder="Ej: 8°A - Tecnología"
            />
          </div>

          <div className="space-y-2">
            <Label>Objetivo de la clase</Label>
            <Textarea
              value={classObjective}
              onChange={e => setClassObjective(e.target.value)}
              required
              maxLength={500}
              rows={2}
              placeholder="Ej: Reconocer las partes del computador y su función"
            />
          </div>

          {/* Recurrence */}
          <div className="rounded-md border border-border p-3 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={isRecurring} onCheckedChange={(v) => setIsRecurring(!!v)} />
              <Repeat className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-foreground">Reserva recurrente (semanal)</span>
            </label>
            {isRecurring && (
              <div className="space-y-2 pl-6">
                <Label className="text-xs">Repetir cada semana hasta</Label>
                <Input
                  type="date"
                  value={recurrenceEndDate}
                  onChange={e => setRecurrenceEndDate(e.target.value)}
                  min={date}
                  required={isRecurring}
                />
                {previewCount > 1 && (
                  <p className="text-xs text-muted-foreground">
                    Se crearán <span className="font-semibold text-foreground">{previewCount}</span> reservas (mismo día de la semana, mismos bloques). El admin podrá aprobarlas todas a la vez.
                  </p>
                )}
                <p className="text-[11px] text-muted-foreground/80">
                  Nota: con reservas recurrentes no se asignan materiales (solicítalos por separado si los necesitas).
                </p>
              </div>
            )}
          </div>

          {!isRecurring && materials && materials.length > 0 && (
            <div className="space-y-2">
              <Label>Materiales adicionales (opcional)</Label>
              <div className="space-y-2 rounded-md border border-border p-3">
                {materials.map(m => (
                  <div key={m.id} className="flex items-center gap-3">
                    <Checkbox
                      checked={!!selectedMaterials[m.id]}
                      onCheckedChange={() => toggleMaterial(m.id)}
                    />
                    <span className="text-sm flex-1 text-foreground">{m.name} <span className="text-muted-foreground">(disp: {m.quantity_available})</span></span>
                    {selectedMaterials[m.id] && (
                      <Input
                        type="number"
                        min={1}
                        max={m.quantity_available}
                        value={selectedMaterials[m.id]}
                        onChange={e => setMaterialQty(m.id, Math.min(parseInt(e.target.value) || 1, m.quantity_available))}
                        className="w-16 h-8 text-sm"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Observación (opcional)</Label>
            <Textarea
              value={observation}
              onChange={e => setObservation(e.target.value)}
              placeholder="Actividad a realizar, requerimientos especiales..."
              rows={3}
              maxLength={500}
            />
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Enviando..." : "Enviar solicitud"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
