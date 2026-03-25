import { useState, useEffect } from "react";
import { format } from "date-fns";
import { useScheduleSettings, generateBlocks } from "@/hooks/useScheduleSettings";
import { useCreateReservation } from "@/hooks/useReservations";
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

interface ReservationFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedDate?: string;
  preselectedBlock?: number;
}

export default function ReservationForm({ open, onOpenChange, preselectedDate, preselectedBlock }: ReservationFormProps) {
  const { data: settings } = useScheduleSettings();
  const { data: materials } = useMaterials();
  const createReservation = useCreateReservation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [date, setDate] = useState(preselectedDate || format(new Date(), "yyyy-MM-dd"));
  const [blockStart, setBlockStart] = useState(preselectedBlock?.toString() || "1");
  const [blockEnd, setBlockEnd] = useState(preselectedBlock?.toString() || "1");
  const [courseName, setCourseName] = useState("");
  const [observation, setObservation] = useState("");
  const [selectedMaterials, setSelectedMaterials] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  const blocks = settings ? generateBlocks(settings) : [];

  useEffect(() => {
    if (preselectedDate) setDate(preselectedDate);
    if (preselectedBlock) {
      setBlockStart(preselectedBlock.toString());
      setBlockEnd(preselectedBlock.toString());
    }
  }, [preselectedDate, preselectedBlock]);

  const toggleMaterial = (materialId: string, maxQty: number) => {
    setSelectedMaterials(prev => {
      const next = { ...prev };
      if (next[materialId]) {
        delete next[materialId];
      } else {
        next[materialId] = 1;
      }
      return next;
    });
  };

  const setMaterialQty = (materialId: string, qty: number) => {
    setSelectedMaterials(prev => ({ ...prev, [materialId]: qty }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      // Create room reservation
      await createReservation.mutateAsync({
        reservation_date: date,
        block_start: parseInt(blockStart),
        block_end: parseInt(blockEnd),
        course_name: courseName,
        observation: observation || undefined,
      });

      // Create material reservations if any
      const matEntries = Object.entries(selectedMaterials);
      if (matEntries.length > 0) {
        const matReservations = matEntries.map(([material_id, quantity]) => ({
          reservation_date: date,
          block_start: parseInt(blockStart),
          block_end: parseInt(blockEnd),
          course_name: courseName,
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
      onOpenChange(false);
      setCourseName("");
      setObservation("");
      setSelectedMaterials({});
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

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
                  {blocks.map(b => (
                    <SelectItem key={b.number} value={b.number.toString()}>
                      Bloque {b.number} ({b.startTime})
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
                  {blocks.filter(b => b.number >= parseInt(blockStart)).map(b => (
                    <SelectItem key={b.number} value={b.number.toString()}>
                      Bloque {b.number} ({b.endTime})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Asignatura / Curso</Label>
            <Input value={courseName} onChange={e => setCourseName(e.target.value)} required placeholder="Ej: 8°A - Tecnología" />
          </div>

          {/* Materials section */}
          {materials && materials.length > 0 && (
            <div className="space-y-2">
              <Label>Materiales adicionales (opcional)</Label>
              <div className="space-y-2 rounded-md border border-border p-3">
                {materials.map(m => (
                  <div key={m.id} className="flex items-center gap-3">
                    <Checkbox
                      checked={!!selectedMaterials[m.id]}
                      onCheckedChange={() => toggleMaterial(m.id, m.quantity_available)}
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
            <Textarea value={observation} onChange={e => setObservation(e.target.value)} placeholder="Actividad a realizar, requerimientos especiales..." rows={3} />
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Enviando..." : "Enviar solicitud"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
