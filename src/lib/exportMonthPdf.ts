import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
} from "date-fns";
import { es } from "date-fns/locale";

interface Reservation {
  id: string;
  reservation_date: string;
  block_start: number;
  block_end: number;
  course_name: string;
  class_objective?: string | null;
  teacher_id: string;
  status: string;
}

interface ScheduleBlock {
  block_number: number;
  start_time: string;
  end_time: string;
}

interface ExportOptions {
  monthDate: Date;
  reservations: Reservation[];
  blocks: ScheduleBlock[];
  getTeacherName: (teacherId: string) => string;
  establishmentName?: string;
}

/**
 * Exports the monthly calendar as a landscape PDF, one page per week.
 * Each cell shows: course - teacher - objective for every reservation that day.
 */
export function exportMonthlyCalendarPdf({
  monthDate,
  reservations,
  blocks,
  getTeacherName,
  establishmentName,
}: ExportOptions) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  const monthLabel = format(monthDate, "MMMM yyyy", { locale: es });
  const title = establishmentName || "Calendario de Reservas";

  // Group approved reservations by date
  const byDate: Record<string, Reservation[]> = {};
  reservations.forEach((r) => {
    if (r.status !== "approved") return;
    byDate[r.reservation_date] = byDate[r.reservation_date] || [];
    byDate[r.reservation_date].push(r);
  });

  // Sort each day's reservations by block_start
  Object.values(byDate).forEach((list) =>
    list.sort((a, b) => a.block_start - b.block_start)
  );

  // Get all weeks of the month (Mon-Sun grid)
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const allDays = eachDayOfInterval({ start: calStart, end: calEnd });

  const weeks: Date[][] = [];
  for (let i = 0; i < allDays.length; i += 7) {
    weeks.push(allDays.slice(i, i + 7));
  }

  // Header
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(title, pageWidth / 2, 14, { align: "center" });

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Calendario mensual — ${monthLabel.charAt(0).toUpperCase()}${monthLabel.slice(1)}`,
    pageWidth / 2,
    21,
    { align: "center" }
  );

  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(
    `Generado el ${format(new Date(), "d 'de' MMMM yyyy, HH:mm", { locale: es })}`,
    pageWidth / 2,
    26,
    { align: "center" }
  );
  doc.setTextColor(0);

  // Build table: header row = weekdays, body rows = each week
  const head = [["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]];

  const body = weeks.map((week) =>
    week.map((day) => {
      const key = format(day, "yyyy-MM-dd");
      const items = byDate[key] || [];
      const inMonth = isSameMonth(day, monthDate);
      const dayLabel = format(day, "d");

      if (items.length === 0) {
        return inMonth ? dayLabel : `(${dayLabel})`;
      }

      const lines = items.map((r) => {
        const blockBlk = blocks.find((b) => b.block_number === r.block_start);
        const time = blockBlk ? blockBlk.start_time.slice(0, 5) : `B${r.block_start}`;
        const teacher = getTeacherName(r.teacher_id) || "—";
        const blockRange =
          r.block_end > r.block_start
            ? `B${r.block_start}-${r.block_end}`
            : `B${r.block_start}`;
        const objective = r.class_objective ? ` · ${r.class_objective}` : "";
        return `${time} (${blockRange}) ${r.course_name}\n  ${teacher}${objective}`;
      });

      const prefix = inMonth ? `${dayLabel}\n` : `(${dayLabel})\n`;
      return prefix + lines.join("\n");
    })
  );

  autoTable(doc, {
    startY: 32,
    head,
    body,
    styles: {
      fontSize: 7,
      cellPadding: 1.5,
      valign: "top",
      lineColor: [180, 180, 180],
      lineWidth: 0.2,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [30, 58, 138], // navy
      textColor: 255,
      fontSize: 9,
      fontStyle: "bold",
      halign: "center",
    },
    columnStyles: Array.from({ length: 7 }).reduce<Record<number, any>>(
      (acc, _, i) => {
        acc[i] = { cellWidth: (pageWidth - 20) / 7 };
        return acc;
      },
      {}
    ),
    margin: { top: 32, left: 10, right: 10, bottom: 12 },
    didParseCell: (data) => {
      if (data.section !== "body") return;
      const week = weeks[data.row.index];
      const day = week?.[data.column.index];
      if (!day) return;
      const inMonth = isSameMonth(day, monthDate);
      if (!inMonth) {
        data.cell.styles.textColor = [170, 170, 170];
        data.cell.styles.fillColor = [248, 248, 248];
      }
      const key = format(day, "yyyy-MM-dd");
      if ((byDate[key] || []).length > 0 && inMonth) {
        data.cell.styles.fillColor = [240, 245, 255];
      }
    },
  });

  // Footer page numbers
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(
      `Página ${i} de ${pageCount}`,
      pageWidth - 10,
      doc.internal.pageSize.getHeight() - 6,
      { align: "right" }
    );
  }

  const filename = `calendario-${format(monthDate, "yyyy-MM")}.pdf`;
  doc.save(filename);
}
