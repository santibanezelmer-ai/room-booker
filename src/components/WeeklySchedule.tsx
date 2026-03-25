import { useMemo } from "react";
import { format, startOfWeek, addDays } from "date-fns";
import { es } from "date-fns/locale";
import { useScheduleSettings, generateBlocks } from "@/hooks/useScheduleSettings";
import { useReservations } from "@/hooks/useReservations";
import { useProfiles } from "@/hooks/useProfiles";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const STATUS_STYLES: Record<string, string> = {
  approved: "bg-status-approved text-status-approved-foreground",
  pending: "bg-status-pending text-status-pending-foreground",
  rejected: "bg-status-rejected text-status-rejected-foreground",
};

const STATUS_LABELS: Record<string, string> = {
  approved: "Aprobado",
  pending: "Pendiente",
  rejected: "Rechazado",
};

interface WeeklyScheduleProps {
  currentDate: Date;
  onSlotClick?: (date: string, blockNumber: number) => void;
}

export default function WeeklySchedule({ currentDate, onSlotClick }: WeeklyScheduleProps) {
  const { data: settings, isLoading: loadingSettings } = useScheduleSettings();
  const { data: profiles } = useProfiles();

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 5 }, (_, i) => addDays(weekStart, i));

  const dateRange = {
    from: format(weekDays[0], "yyyy-MM-dd"),
    to: format(weekDays[4], "yyyy-MM-dd"),
  };

  const { data: reservations, isLoading: loadingRes } = useReservations(dateRange);

  const blocks = useMemo(() => (settings ? generateBlocks(settings) : []), [settings]);

  const getTeacherName = (teacherId: string) => {
    const p = profiles?.find(pr => pr.user_id === teacherId);
    return p?.full_name || "";
  };

  const getReservation = (date: string, blockNum: number) => {
    return reservations?.find(
      (r) => r.reservation_date === date && r.block_start <= blockNum && r.block_end >= blockNum
    );
  };

  if (loadingSettings) return <Skeleton className="h-96 w-full rounded-lg" />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="border border-border bg-muted px-3 py-2 text-left font-medium text-muted-foreground w-24">
              Bloque
            </th>
            {weekDays.map((day) => (
              <th key={day.toISOString()} className="border border-border bg-muted px-3 py-2 text-center font-medium text-muted-foreground min-w-[120px]">
                <div className="text-xs uppercase">{format(day, "EEE", { locale: es })}</div>
                <div className="text-foreground">{format(day, "d MMM", { locale: es })}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {blocks.map((block) => (
            <tr key={block.number}>
              <td className="border border-border px-3 py-2 bg-muted/50">
                <div className="font-medium text-foreground">Bloque {block.number}</div>
                <div className="text-xs text-muted-foreground">{block.startTime} - {block.endTime}</div>
              </td>
              {weekDays.map((day) => {
                const dateStr = format(day, "yyyy-MM-dd");
                const reservation = getReservation(dateStr, block.number);

                return (
                  <td
                    key={dateStr}
                    className={`border border-border px-2 py-2 text-center transition-colors ${
                      !reservation ? "bg-card hover:bg-accent cursor-pointer" : ""
                    }`}
                    onClick={() => !reservation && onSlotClick?.(dateStr, block.number)}
                  >
                    {loadingRes ? (
                      <Skeleton className="h-6 w-full" />
                    ) : reservation ? (
                      <div className="space-y-0.5">
                        <Badge className={`text-xs ${STATUS_STYLES[reservation.status]}`}>
                          {STATUS_LABELS[reservation.status] || reservation.status}
                        </Badge>
                        <div className="text-xs text-foreground font-medium truncate">{reservation.course_name}</div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {getTeacherName(reservation.teacher_id)}
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-status-available font-medium">Disponible</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
