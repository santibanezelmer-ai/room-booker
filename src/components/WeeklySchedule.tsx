import { format, startOfWeek, addDays, getISODay } from "date-fns";
import { es } from "date-fns/locale";
import { useScheduleBlocks } from "@/hooks/useScheduleBlocks";
import { useReservations } from "@/hooks/useReservations";
import { useProfiles } from "@/hooks/useProfiles";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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
  const { data: blocks, isLoading: loadingBlocks } = useScheduleBlocks();
  const { data: profiles } = useProfiles();

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  // Monday to Friday (5 days)
  const weekDays = Array.from({ length: 5 }, (_, i) => addDays(weekStart, i));

  const dateRange = {
    from: format(weekDays[0], "yyyy-MM-dd"),
    to: format(weekDays[4], "yyyy-MM-dd"),
  };

  const { data: reservations, isLoading: loadingRes } = useReservations(dateRange);

  // All unique block numbers across all days
  const allBlocks = blocks || [];

  const getTeacherName = (teacherId: string) => {
    const p = profiles?.find(pr => pr.user_id === teacherId);
    return p?.full_name || "";
  };

  const getReservation = (date: string, blockNum: number) => {
    return reservations?.find(
      (r) => r.reservation_date === date && r.block_start <= blockNum && r.block_end >= blockNum
    );
  };

  const isToday = (day: Date) => format(day, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
  const formatTime = (t: string) => t.slice(0, 5);

  if (loadingBlocks) return <Skeleton className="h-96 w-full rounded-xl" />;

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="border-b border-r border-border bg-muted/70 px-3 py-3 text-left font-semibold text-muted-foreground w-28">
              Bloque
            </th>
            {weekDays.map((day) => (
              <th
                key={day.toISOString()}
                className={`border-b border-r last:border-r-0 border-border px-3 py-3 text-center font-semibold min-w-[130px] ${
                  isToday(day) ? "bg-primary/8 text-primary" : "bg-muted/70 text-muted-foreground"
                }`}
              >
                <div className="text-[11px] uppercase tracking-wider">{format(day, "EEE", { locale: es })}</div>
                <div className={`text-sm mt-0.5 ${isToday(day) ? "text-primary font-bold" : "text-foreground"}`}>
                  {format(day, "d MMM", { locale: es })}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {allBlocks.map((block, idx) => (
            <tr key={block.block_number} className={idx % 2 === 0 ? "" : "bg-muted/20"}>
              <td className="border-b border-r border-border px-3 py-2.5 bg-muted/30">
                <div className="font-semibold text-foreground text-xs">Bloque {block.block_number}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{formatTime(block.start_time)} - {formatTime(block.end_time)}</div>
              </td>
              {weekDays.map((day) => {
                const dateStr = format(day, "yyyy-MM-dd");
                const dayOfWeek = getISODay(day); // 1=Mon, 5=Fri
                const isAvailable = block.available_days?.includes(dayOfWeek) ?? true;

                if (!isAvailable) {
                  return (
                    <td
                      key={dateStr}
                      className="border-b border-r last:border-r-0 border-border bg-muted/40 px-2 py-2 text-center"
                    >
                      <span className="text-[10px] text-muted-foreground/50">—</span>
                    </td>
                  );
                }

                const reservation = getReservation(dateStr, block.block_number);

                return (
                  <td
                    key={dateStr}
                    className={`border-b border-r last:border-r-0 border-border px-2 py-2 text-center transition-all duration-150 ${
                      !reservation
                        ? "hover:bg-primary/5 cursor-pointer group"
                        : ""
                    } ${isToday(day) ? "bg-primary/[0.03]" : ""}`}
                    onClick={() => !reservation && onSlotClick?.(dateStr, block.block_number)}
                  >
                    {loadingRes ? (
                      <Skeleton className="h-8 w-full rounded-md" />
                    ) : reservation ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="space-y-1 px-1">
                            <Badge className={`text-[10px] px-1.5 py-0 leading-5 font-medium ${STATUS_STYLES[reservation.status]}`}>
                              {STATUS_LABELS[reservation.status] || reservation.status}
                            </Badge>
                            <div className="text-xs text-foreground font-medium truncate leading-tight">{reservation.course_name}</div>
                            <div className="text-[10px] text-muted-foreground truncate leading-tight">
                              {getTeacherName(reservation.teacher_id)}
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[220px]">
                          <p className="font-semibold">{reservation.course_name}</p>
                          <p className="text-xs">{getTeacherName(reservation.teacher_id)}</p>
                          {reservation.observation && <p className="text-xs mt-1 text-muted-foreground">{reservation.observation}</p>}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className="text-[11px] text-status-available/70 group-hover:text-status-available font-medium transition-colors">
                        Disponible
                      </span>
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
