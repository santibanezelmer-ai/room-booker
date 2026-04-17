import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useEstablishmentSettings } from "@/hooks/useEstablishmentSettings";
import { supabase } from "@/integrations/supabase/client";
import WeeklySchedule from "@/components/WeeklySchedule";
import ReservationForm from "@/components/ReservationForm";
import MyReservations from "@/components/MyReservations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CalendarDays, Plus, ClipboardList, LogOut, ChevronLeft, ChevronRight, Monitor, KeyRound } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { addWeeks, subWeeks, format, startOfWeek, endOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

export default function TeacherDashboard() {
  const { user, signOut } = useAuth();
  const { data: estSettings } = useEstablishmentSettings();
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [formOpen, setFormOpen] = useState(false);
  const [preDate, setPreDate] = useState<string>();
  const [preBlock, setPreBlock] = useState<number>();

  // Change password
  const [passwordDialog, setPasswordDialog] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: "Error", description: "Las contraseñas no coinciden.", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Error", description: "La contraseña debe tener al menos 6 caracteres.", variant: "destructive" });
      return;
    }
    setPasswordLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Contraseña actualizada", description: "Tu contraseña ha sido cambiada exitosamente." });
      setPasswordDialog(false);
      setNewPassword("");
      setConfirmPassword("");
    }
    setPasswordLoading(false);
  };

  const handleSlotClick = (date: string, block: number) => {
    setPreDate(date);
    setPreBlock(block);
    setFormOpen(true);
  };

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });

  const appName = estSettings?.name || "Sala de Computación";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-sm">
        <div className="container mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            {estSettings?.logo_url ? (
              <img src={estSettings.logo_url} alt="Logo" className="h-9 w-9 rounded-xl object-cover shadow-sm ring-1 ring-border/50" />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary shadow-sm">
                <Monitor className="h-5 w-5 text-primary-foreground" />
              </div>
            )}
            <div>
              <h1 className="text-base font-bold text-foreground leading-tight">{appName}</h1>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => { setPreDate(undefined); setPreBlock(undefined); setFormOpen(true); }} className="shadow-sm">
              <Plus className="h-4 w-4 mr-1" /> Nueva Reserva
            </Button>
            <ThemeToggle />
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setPasswordDialog(true)} title="Cambiar clave">
              <KeyRound className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={signOut} title="Cerrar sesión">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        <Tabs defaultValue="schedule" className="w-full">
          <TabsList className="bg-card border border-border shadow-sm">
            <TabsTrigger value="schedule"><CalendarDays className="h-4 w-4 mr-1.5" />Horario</TabsTrigger>
            <TabsTrigger value="requests"><ClipboardList className="h-4 w-4 mr-1.5" />Mis Solicitudes</TabsTrigger>
          </TabsList>

          <TabsContent value="schedule" className="space-y-4 mt-4">
            <div className="flex items-center justify-between bg-card rounded-xl border border-border px-4 py-2.5 shadow-sm">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentDate(subWeeks(currentDate, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-semibold text-foreground">
                {format(weekStart, "d MMM", { locale: es })} — {format(weekEnd, "d MMM yyyy", { locale: es })}
              </span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentDate(addWeeks(currentDate, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <WeeklySchedule currentDate={currentDate} onSlotClick={handleSlotClick} />
          </TabsContent>

          <TabsContent value="requests" className="mt-4">
            <MyReservations />
          </TabsContent>
        </Tabs>
      </main>

      <ReservationForm
        open={formOpen}
        onOpenChange={setFormOpen}
        preselectedDate={preDate}
        preselectedBlock={preBlock}
      />

      {/* Password change dialog */}
      <Dialog open={passwordDialog} onOpenChange={setPasswordDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Cambiar Contraseña</DialogTitle></DialogHeader>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label>Nueva contraseña</Label>
              <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={6} placeholder="Mínimo 6 caracteres" />
            </div>
            <div className="space-y-2">
              <Label>Confirmar contraseña</Label>
              <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={6} placeholder="Repite la contraseña" />
            </div>
            <Button type="submit" className="w-full" disabled={passwordLoading}>
              {passwordLoading ? "Actualizando..." : "Cambiar Contraseña"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
