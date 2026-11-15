// Función de Supabase que envía por Resend el correo de una cotización.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type EventType = "created" | "enviada" | "aprobada" | "rechazada";

type EmailItem = { name: string; quantity: number; unitPrice: number };

const MAX_ITEMS = 200;
const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

// Escapa el texto del usuario antes de ponerlo en el HTML.
function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function sanitizeDisplayName(value: unknown): string {
  return String(value ?? "")
    .replace(/[<>"\r\n,;]/g, "")
    .trim()
    .slice(0, 80);
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// Verifica la sesión del usuario con Supabase Auth.
async function isAuthenticated(req: Request): Promise<boolean> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!supabaseUrl || !anonKey || !authHeader.startsWith("Bearer ")) return false;
  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: authHeader, apikey: anonKey },
  });
  if (!res.ok) return false;
  const user = await res.json();
  return typeof user?.id === "string" && user.id.length > 0;
}

const EVENT_META: Record<
  EventType,
  {
    accentColor: string;
    subject: (folio: string, biz: string) => string;
    headline: string;
    body: (folio: string, biz: string, name: string) => string;
  }
> = {
  created: {
    accentColor: "#5e35b1",
    subject: (folio, biz) => `Cotización ${folio}${biz ? ` · ${biz}` : ""}`,
    headline: "Nueva cotización",
    body: (folio, biz, name) =>
      `Estimado/a <strong style="color:#222">${name}</strong>, adjuntamos la cotización <strong>${folio}</strong>${biz ? ` de parte de <strong>${biz}</strong>` : ""} con el detalle de los insumos solicitados.`,
  },
  enviada: {
    accentColor: "#0369a1",
    subject: (folio, biz) => `Tu cotización ${folio} ha sido enviada${biz ? ` · ${biz}` : ""}`,
    headline: "Cotización enviada",
    body: (folio, biz, name) =>
      `Estimado/a <strong style="color:#222">${name}</strong>, la cotización <strong>${folio}</strong>${biz ? ` de <strong>${biz}</strong>` : ""} ha sido marcada como <strong>enviada</strong> y está en revisión.`,
  },
  aprobada: {
    accentColor: "#15803d",
    subject: (folio, biz) => `¡Cotización ${folio} aprobada!${biz ? ` · ${biz}` : ""}`,
    headline: "Cotización aprobada",
    body: (folio, biz, name) =>
      `Estimado/a <strong style="color:#222">${name}</strong>, nos complace informarte que la cotización <strong>${folio}</strong>${biz ? ` de <strong>${biz}</strong>` : ""} ha sido <strong style="color:#15803d">aprobada</strong>. Pronto nos pondremos en contacto para coordinar los siguientes pasos.`,
  },
  rechazada: {
    accentColor: "#b91c1c",
    subject: (folio, biz) => `Cotización ${folio} rechazada${biz ? ` · ${biz}` : ""}`,
    headline: "Cotización rechazada",
    body: (folio, biz, name) =>
      `Estimado/a <strong style="color:#222">${name}</strong>, lamentamos informarte que la cotización <strong>${folio}</strong>${biz ? ` de <strong>${biz}</strong>` : ""} ha sido <strong style="color:#b91c1c">rechazada</strong>. Si tienes preguntas o deseas explorar otras opciones, no dudes en contactarnos.`,
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    if (!(await isAuthenticated(req))) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const {
      quote,
      clientEmail,
      businessName,
      currency,
      exchangeRate: rate,
      eventType: rawEvent,
    } = await req.json();
    const exchangeRate: number = typeof rate === "number" && rate > 0 ? rate : 1;
    const eventType: EventType = (
      ["created", "enviada", "aprobada", "rechazada"] as EventType[]
    ).includes(rawEvent)
      ? rawEvent
      : "created";

    if (!quote || typeof clientEmail !== "string" || !EMAIL_RE.test(clientEmail.trim())) {
      return jsonResponse({ error: "Missing or invalid fields" }, 400);
    }
    const items: EmailItem[] = Array.isArray(quote.items) ? quote.items.slice(0, MAX_ITEMS) : [];
    const folio = escapeHtml(quote.folio);
    const clientName = escapeHtml(quote.clientName);
    const notes = escapeHtml(quote.notes);

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      return jsonResponse({ error: "RESEND_API_KEY not configured" }, 500);
    }

    const locale =
      { COP: "es-CO", USD: "en-US", MXN: "es-MX", EUR: "de-DE" }[currency as string] ?? "es-CO";
    const cur = ["COP", "USD", "MXN", "EUR"].includes(currency) ? currency : "COP";
    const fmt = new Intl.NumberFormat(locale, {
      style: "currency",
      currency: cur,
      maximumFractionDigits: 0,
    });
    const cvt = (amount: unknown) => fmt.format(toNumber(amount) / exchangeRate);

    const meta = EVENT_META[eventType];
    const bizName = sanitizeDisplayName(businessName);
    const biz = escapeHtml(bizName);
    const from = bizName
      ? `${bizName} via Quanty <onboarding@resend.dev>`
      : "Quanty <onboarding@resend.dev>";
    const to = Deno.env.get("RESEND_TEST_TO") ?? clientEmail.trim();

    const itemRows = items
      .map(
        (it) =>
          `<tr><td style="padding:6px 8px;border-bottom:1px solid #eee">${escapeHtml(it.name)}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center">${toNumber(it.quantity)}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;font-family:monospace">${cvt(it.unitPrice)}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;font-family:monospace;font-weight:bold">${cvt(toNumber(it.unitPrice) * toNumber(it.quantity))}</td></tr>`,
      )
      .join("");

    const laborRow =
      toNumber(quote.laborEmployeeAmount) > 0
        ? `<tr><td colspan="3" style="padding:6px 8px;color:#666">M.O. empleados (${toNumber(quote.laborWorkers)} × ${toNumber(quote.laborHours)}h)</td><td style="padding:6px 8px;text-align:right;font-family:monospace">${cvt(quote.laborEmployeeAmount)}</td></tr>`
        : "";

    const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:system-ui,sans-serif;background:#f5f5f5">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)">
    <div style="background:${meta.accentColor};height:6px"></div>
    <div style="padding:32px 32px 0">
      <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:.1em;color:${meta.accentColor};text-transform:uppercase">${meta.headline}</p>
      <h1 style="margin:4px 0 4px;font-size:28px;font-weight:800;color:#141414">${folio}</h1>
      <p style="font-size:14px;color:#444;margin-top:12px">${meta.body(folio, biz, clientName)}</p>
    </div>
    <div style="padding:24px 32px">
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <thead>
          <tr style="background:#f5f3fa">
            <th style="padding:8px;text-align:left;color:${meta.accentColor};font-size:11px;text-transform:uppercase;letter-spacing:.06em">Insumo</th>
            <th style="padding:8px;text-align:center;color:${meta.accentColor};font-size:11px;text-transform:uppercase;letter-spacing:.06em">Cant.</th>
            <th style="padding:8px;text-align:right;color:${meta.accentColor};font-size:11px;text-transform:uppercase;letter-spacing:.06em">P. Unit.</th>
            <th style="padding:8px;text-align:right;color:${meta.accentColor};font-size:11px;text-transform:uppercase;letter-spacing:.06em">Total</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
        <tfoot>
          <tr><td colspan="3" style="padding:8px;color:#666;font-size:13px">Subtotal</td><td style="padding:8px;text-align:right;font-family:monospace;font-size:13px">${cvt(quote.subtotal)}</td></tr>
          ${laborRow}
          <tr style="border-top:2px solid #eee">
            <td colspan="3" style="padding:10px 8px;font-weight:700;font-size:15px;color:#141414">Total</td>
            <td style="padding:10px 8px;text-align:right;font-family:monospace;font-size:18px;font-weight:800;color:${meta.accentColor}">${cvt(quote.total)}</td>
          </tr>
        </tfoot>
      </table>
      ${notes ? `<div style="margin-top:16px;background:#f8f8fa;border-radius:8px;padding:12px 16px"><p style="margin:0 0 4px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#999">Notas</p><p style="margin:0;font-size:13px;color:#444">${notes}</p></div>` : ""}
    </div>
    <div style="padding:20px 32px;background:#fafafa;border-top:1px solid #eee;text-align:center">
      <p style="margin:0;font-size:11px;color:#aaa">Generado por <strong style="color:#5e35b1">Quanty</strong> · Insumos &amp; Cotizaciones</p>
    </div>
  </div>
</body>
</html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: meta.subject(String(quote.folio ?? "").slice(0, 40), bizName),
        html,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("resend error", res.status, body);
      return jsonResponse({ error: "Email provider error" }, 502);
    }

    const data = await res.json();
    return jsonResponse({ id: data.id }, 200);
  } catch (err) {
    console.error("send-quote-email error", err);
    return jsonResponse({ error: "Internal error" }, 500);
  }
});
