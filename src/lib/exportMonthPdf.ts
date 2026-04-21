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
  logoUrl?: string | null;
}

/**
 * Load an image from URL and convert to base64 data URL
 */
function loadImageAsDataUrl(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } else {
        resolve(null);
      }
    };
    
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/**
 * Exports the monthly calendar as a landscape PDF, one page per week.
 * Each cell shows: course - teacher - objective for every reservation that day.
 */
export async function exportMonthlyCalendarPdf({
  monthDate,
  reservations,
  blocks,
  getTeacherName,
  establishmentName,
  logoUrl,
}: ExportOptions) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Load and add logo if available
  let logoDataUrl: string | null = null;
  if (logoUrl) {
    logoDataUrl = await loadImageAsDataUrl(logoUrl);
  }

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

  // Header with logo
  let startY = 14;
  
  // Add logo if loaded
  if (logoDataUrl) {
    try {
      const imgProps = doc.getImageProperties(logoDataUrl);
      const logoWidth = 25;
      const logoHeight = (imgProps.height * logoWidth) / imgProps.width;
      doc.addImage(logoDataUrl, "PNG", 10, 5, logoWidth, logoHeight);
      startY = Math.max(startY, 5 + logoHeight + 8);
    } catch {
      // Silently fail if logo can't be added
    }
  }

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(title, pageWidth / 2, startY, { align: "center" });

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Calendario mensual — ${monthLabel.charAt(0).toUpperCase()}${monthLabel.slice(1)}`,
    pageWidth / 2,
    startY + 7,
    { align: "center" }
  );

  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(
    `Generado el ${format(new Date(), "d 'de' MMMM yyyy, HH:mm", { locale: es })}`,
    pageWidth / 2,
    startY + 12,
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
    startY: startY + 18,
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
    margin: { top: startY + 18, left: 10, right: 10, bottom: 12 },
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