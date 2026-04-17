import { useState } from "react";
import { Link } from "react-router-dom";
import { addWeeks, subWeeks, format, startOfWeek, endOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import WeeklySchedule from "@/components/WeeklySchedule";
import { useEstablishmentSettings } from "@/hooks/useEstablishmentSettings";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Monitor, LogIn, CalendarDays } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";

export default function PublicSchedule() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const { data: estSettings } = useEstablishmentSettings();

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const appName = estSettings?.name || "Sala de Computación";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-sm">
        <div className="container mx-auto flex items-center justify-between px-4 py-3 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {estSettings?.logo_url ? (
              <img src={estSettings.logo_url} alt="Logo" className="h-9 w-9 rounded-xl object-cover shadow-sm ring-1 ring-border/50" />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary shadow-sm">
                <Monitor className="h-5 w-5 text-primary-foreground" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-base font-bold text-foreground leading-tight truncate">{appName}</h1>
              <p className="text-xs text-muted-foreground">Horario público</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button asChild size="sm">
              <Link to="/">
                <LogIn className="h-4 w-4 mr-1" /> Iniciar sesión
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarDays className="h-4 w-4" />
          <span>Calendario de uso de la sala. Solo se muestran reservas aprobadas.</span>
        </div>

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

        <WeeklySchedule currentDate={currentDate} publicMode />

        <p className="text-xs text-center text-muted-foreground pt-4">
          Para solicitar reservas necesitas iniciar sesión con tu cuenta docente.
        </p>
      </main>
    </div>
  );
}
