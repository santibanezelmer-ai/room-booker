import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = Deno.env.get("RESERVATION_FROM_EMAIL") ?? "Sala de Computación <onboarding@resend.dev>";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

type EventType = "new_request" | "approved" | "rejected" | "released";

const EVENT_FLAG: Record<EventType, string> = {
  new_request: "notify_new_request",
  approved: "notify_approved",
  rejected: "notify_rejected",
  released: "notify_released",
};

function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(iso: string): string {
  try {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("es-CL", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return iso;
  }
}

function layout(opts: {
  appName: string;
  logoUrl?: string | null;
  title: string;
  intro: string;
  rows: Array<[string, string]>;
  note?: string | null;
  accent: string;
}): string {
  const rows = opts.rows
    .filter(([, v]) => v)
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#64748b;font-size:13px;white-space:nowrap;vertical-align:top">${esc(k)}</td><td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:600">${esc(v)}</td></tr>`,
    )
    .join("");
  const logo = opts.logoUrl
    ? `<img src="${esc(opts.logoUrl)}" alt="" width="44" height="44" style="border-radius:10px;object-fit:cover;display:block" />`
    : "";
  const note = opts.note
    ? `<div style="margin-top:16px;padding:12px 14px;background:#f1f5f9;border-radius:10px;color:#334155;font-size:13px;line-height:1.5">${esc(opts.note)}</div>`
    : "";
  return `<!doctype html><html lang="es"><body style="margin:0;background:#f8fafc;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">
        <tr><td style="background:#0f2f5c;padding:18px 24px">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="padding-right:12px">${logo}</td>
            <td style="color:#ffffff;font-size:16px;font-weight:700">${esc(opts.appName)}</td>
          </tr></table>
        </td></tr>
        <tr><td style="height:4px;background:${opts.accent}"></td></tr>
        <tr><td style="padding:24px">
          <h1 style="margin:0 0 8px;font-size:19px;color:#0f172a">${esc(opts.title)}</h1>
          <p style="margin:0 0 18px;font-size:14px;color:#475569;line-height:1.5">${esc(opts.intro)}</p>
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">${rows}</table>
          ${note}
        </td></tr>
        <tr><td style="padding:14px 24px;background:#f8fafc;color:#94a3b8;font-size:11px;text-align:center">
          Mensaje automático del sistema de reservas — no responder.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!LOVABLE_API_KEY || !RESEND_API_KEY) {
    throw new Error("Email provider not configured");
  }
  const res = await fetch(`${GATEWAY_URL}/emails`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": RESEND_API_KEY,
    },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[${res.status}] ${body}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const authClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await authClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);

    const payload = await req.json().catch(() => ({}));
    const reservationId: string | undefined = payload?.reservation_id;
    const event: EventType | undefined = payload?.event;
    if (!reservationId || typeof reservationId !== "string") return json({ error: "reservation_id required" }, 400);
    if (!event || !(event in EVENT_FLAG)) return json({ error: "invalid event" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: settings } = await admin.from("notification_settings").select("*").limit(1).maybeSingle();
    if (settings && settings[EVENT_FLAG[event]] === false) {
      return json({ skipped: "disabled" });
    }

    const { data: reservation, error: resErr } = await admin
      .from("reservations")
      .select("*")
      .eq("id", reservationId)
      .maybeSingle();
    if (resErr || !reservation) return json({ error: "Reservation not found" }, 404);

    // Only the owning teacher or an admin may trigger a notification for this reservation.
    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (!isAdmin && reservation.teacher_id !== userData.user.id) return json({ error: "Forbidden" }, 403);

    const { data: notes } = await admin
      .from("reservation_notes")
      .select("observation, admin_notes")
      .eq("reservation_id", reservationId)
      .maybeSingle();

    const { data: profile } = await admin
      .from("profiles")
      .select("full_name, email")
      .eq("user_id", reservation.teacher_id)
      .maybeSingle();

    const { data: est } = await admin.from("establishment_settings").select("name, logo_url").limit(1).maybeSingle();
    const appName = est?.name || "Sala de Computación";

    const { data: blocks } = await admin
      .from("schedule_blocks")
      .select("block_number, start_time, end_time")
      .in("block_number", [reservation.block_start, reservation.block_end]);
    const startBlock = blocks?.find((b) => b.block_number === reservation.block_start);
    const endBlock = blocks?.find((b) => b.block_number === reservation.block_end);
    const timeRange =
      startBlock && endBlock ? `${startBlock.start_time.slice(0, 5)} - ${endBlock.end_time.slice(0, 5)}` : "";
    const blockLabel =
      reservation.block_start === reservation.block_end
        ? `Bloque ${reservation.block_start}`
        : `Bloques ${reservation.block_start} a ${reservation.block_end}`;

    const rows: Array<[string, string]> = [
      ["Fecha", formatDate(reservation.reservation_date)],
      ["Horario", [blockLabel, timeRange].filter(Boolean).join(" · ")],
      ["Curso", reservation.course_name],
      ["Objetivo", reservation.class_objective],
      ["Docente", profile?.full_name || ""],
    ];

    let recipients: string[] = [];
    let subject = "";
    let title = "";
    let intro = "";
    let accent = "#0f2f5c";
    let note: string | null = null;

    if (event === "new_request") {
      recipients = (settings?.admin_emails ?? []).filter((e: string) => !!e);
      subject = `Nueva solicitud de reserva — ${reservation.course_name}`;
      title = "Nueva solicitud de reserva";
      intro = `${profile?.full_name || "Un docente"} solicitó la sala y espera revisión.`;
      accent = "#f59e0b";
      note = notes?.observation ? `Observación del docente: ${notes.observation}` : null;
    } else {
      if (!profile?.email) return json({ skipped: "no recipient" });
      recipients = [profile.email];
      if (event === "approved") {
        subject = `Reserva aprobada — ${reservation.course_name}`;
        title = "Tu reserva fue aprobada";
        intro = "La sala quedó asignada para tu clase en el horario indicado.";
        accent = "#16a34a";
      } else if (event === "rejected") {
        subject = `Reserva rechazada — ${reservation.course_name}`;
        title = "Tu reserva fue rechazada";
        intro = "La solicitud no pudo ser aprobada. Puedes volver a solicitar el bloque.";
        accent = "#dc2626";
        note = notes?.admin_notes ? `Motivo: ${notes.admin_notes}` : null;
      } else {
        subject = `Reserva liberada — ${reservation.course_name}`;
        title = "Tu reserva fue liberada";
        intro = "El administrador liberó el bloque que tenías asignado.";
        accent = "#64748b";
        note = reservation.cancellation_reason ? `Motivo: ${reservation.cancellation_reason}` : null;
      }
    }

    if (recipients.length === 0) return json({ skipped: "no recipients" });

    const html = layout({ appName, logoUrl: est?.logo_url, title, intro, rows, note, accent });

    let sent = 0;
    for (const to of recipients) {
      // Avoid duplicates for the same reservation/event/recipient.
      const { data: existing } = await admin
        .from("notification_log")
        .select("id")
        .eq("reservation_id", reservationId)
        .eq("event_type", event)
        .eq("recipient_email", to)
        .eq("status", "sent")
        .maybeSingle();
      if (existing) continue;

      try {
        await sendEmail(to, subject, html);
        sent++;
        await admin.from("notification_log").insert({
          reservation_id: reservationId,
          recurrence_group_id: reservation.recurrence_group_id,
          event_type: event,
          recipient_email: to,
          status: "sent",
        });
      } catch (e) {
        console.error("send failed", e);
        await admin.from("notification_log").insert({
          reservation_id: reservationId,
          recurrence_group_id: reservation.recurrence_group_id,
          event_type: event,
          recipient_email: to,
          status: "failed",
          error_message: String((e as Error)?.message ?? e).slice(0, 500),
        });
      }
    }

    return json({ sent });
  } catch (e) {
    console.error("send-reservation-email error", e);
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
