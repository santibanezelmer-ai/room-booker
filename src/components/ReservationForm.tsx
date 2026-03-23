import { useState } from "react";
import { format } from "date-fns";
import { useScheduleSettings, generateBlocks } from "@/hooks/useScheduleSettings";
import { useCreateReservation } from "@/hooks/useReservations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface ReservationFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedDate?: string;
  preselectedBlock?: number;
}

export default function ReservationForm({ open, onOpenChange, preselectedDate, preselectedBlock }: ReservationFormProps) {
  const { data: settings } = useScheduleSettings();
  const createReservation = useCreateReservation();
  const { toast } = useToast();

  const [date, setDate] = useState(preselectedDate || format(new Date(), "yyyy-MM-dd"));
  const [blockStart, setBlockStart] = useState(preselectedBlock?.toString() || "1");
  const [blockEnd, setBlockEnd] = useState(preselectedBlock?.toString() || "1");
  const [courseName, setCourseName] = useState("");
  const [observation, setObservation] = useState("");

  const blocks = settings ? generateBlocks(settings) : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createReservation.mutateAsync({
        reservation_date: date,
        block_start: parseInt(blockStart),
        block_end: parseInt(blockEnd),
        course_name: courseName,
        observation: observation || undefined,
      });
      toast({ title: "Solicitud enviada", description: "Tu reserva está pendiente de aprobación." });
      onOpenChange(false);
      setCourseName("");
      setObservation("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  // Reset form when preselected values change
  if (preselectedDate && preselectedDate !== date) setDate(preselectedDate);
  if (preselectedBlock && preselectedBlock.toString() !== blockStart) {
    setBlockStart(preselectedBlock.toString());
    setBlockEnd(preselectedBlock.toString());
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
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
            <Label>Curso o grupo</Label>
            <Input value={courseName} onChange={e => setCourseName(e.target.value)} required placeholder="Ej: 8°A, Taller de Informática" />
          </div>
          <div className="space-y-2">
            <Label>Observación (opcional)</Label>
            <Textarea value={observation} onChange={e => setObservation(e.target.value)} placeholder="Actividad a realizar, requerimientos especiales..." rows={3} />
          </div>
          <Button type="submit" className="w-full" disabled={createReservation.isPending}>
            {createReservation.isPending ? "Enviando..." : "Enviar solicitud"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
