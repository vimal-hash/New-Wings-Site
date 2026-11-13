import { validateEnquiry } from "@/components/corridor/enquiry";

/**
 * Product enquiries. Sends through Resend's HTTP API once these are set (no SDK needed):
 *   RESEND_API_KEY   the Resend key
 *   ENQUIRY_TO       the client's inbox
 *   ENQUIRY_FROM     a sender on a domain verified in Resend, e.g. "New Wings <enquiries@your-domain>"
 * Until then it answers 503 and the form points visitors to email / WhatsApp instead.
 */
export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "invalid" }, { status: 400 }); }
  if (!body || typeof body !== "object") return Response.json({ error: "invalid" }, { status: 400 });
  // A hidden field people never fill; bots usually do.
  if ((body as Record<string, unknown>).website) return Response.json({ ok: true });
  const { errors, enquiry } = validateEnquiry(body as Record<string, unknown>);
  if (Object.keys(errors).length) return Response.json({ error: "invalid", errors }, { status: 400 });

  const key = process.env.RESEND_API_KEY, to = process.env.ENQUIRY_TO, from = process.env.ENQUIRY_FROM;
  if (!key || !to || !from) return Response.json({ error: "not-configured" }, { status: 503 });

  const escape = (text: string) => text.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
  const rows: [string, string][] = [["Name", enquiry.name], ["Email", enquiry.email], ["Mobile", enquiry.phone], ["Product", enquiry.product], ["Message", enquiry.message || "—"]];
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from, to: [to], reply_to: enquiry.email,
      subject: `Enquiry: ${enquiry.product} — ${enquiry.name}`,
      text: rows.map(([k, v]) => `${k}: ${v}`).join("\n"),
      html: `<table>${rows.map(([k, v]) => `<tr><th align="left" valign="top">${k}</th><td style="white-space:pre-wrap">${escape(v)}</td></tr>`).join("")}</table>`,
    }),
  }).catch(() => null);
  if (!response?.ok) return Response.json({ error: "send-failed" }, { status: 502 });
  return Response.json({ ok: true });
}
