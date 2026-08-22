import { SITE_URL } from "@/lib/seo";

type OrderEmailItem = {
  productName: string;
  variantName?: string | null;
  quantity: number;
  lineTotal: number;
};

type OrderEmailInput = {
  customerEmail: string;
  customerName: string;
  orderNumber: string;
  total: number;
  currency: string;
  locale: string;
  paymentStatus: string;
  accessKey: string;
  delivery: {
    addressLine1?: string | null;
    addressLine2?: string | null;
    city?: string | null;
    region?: string | null;
    postalCode?: string | null;
    countryName?: string | null;
    countryCode?: string | null;
  };
  items: OrderEmailItem[];
};

function apiKey() {
  return process.env.RESEND_API_KEY?.trim() || "";
}

function fromAddress() {
  return process.env.ORDER_EMAIL_FROM?.trim() || "";
}

export function orderEmailConfigured() {
  return Boolean(apiKey() && fromAddress());
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatMoney(value: number, currency: string, locale: string) {
  try {
    return new Intl.NumberFormat(locale || "en-US", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: currency === "TZS" ? 0 : 2,
    }).format(value);
  }
  catch {
    return `${currency || "USD"} ${Number(value || 0).toFixed(2)}`;
  }
}

function cleanStatus(value: string) {
  const normalized = value.replaceAll("_", " ").trim();
  if (!normalized) return "Pending payment";
  return normalized.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function deliveryLines(input: OrderEmailInput["delivery"]) {
  return [
    input.addressLine1,
    input.addressLine2,
    [input.city, input.region, input.postalCode].filter(Boolean).join(", "),
    input.countryName || input.countryCode,
  ].filter((value) => String(value || "").trim());
}

export async function sendOrderConfirmationEmail(input: OrderEmailInput) {
  if (!orderEmailConfigured()) {
    return { sent: false as const, reason: "not-configured" as const };
  }

  const orderUrl = new URL(
    `/order-confirmation/${encodeURIComponent(input.orderNumber)}`,
    SITE_URL,
  );
  orderUrl.searchParams.set("key", input.accessKey);

  const itemRows = input.items
    .map((item) => {
      const variant = item.variantName
        ? `<div style="margin-top:4px;color:#7a7165;font-size:12px;">${escapeHtml(item.variantName)}</div>`
        : "";

      return `<tr>
        <td style="padding:14px 0;border-bottom:1px solid #e8e0d4;vertical-align:top;">
          <div style="font-weight:700;color:#1d1914;">${escapeHtml(item.productName)}</div>
          ${variant}
          <div style="margin-top:4px;color:#7a7165;font-size:12px;">Qty ${Math.max(1, Number(item.quantity || 1))}</div>
        </td>
        <td style="padding:14px 0;border-bottom:1px solid #e8e0d4;text-align:right;vertical-align:top;font-weight:700;color:#1d1914;">
          ${escapeHtml(formatMoney(Number(item.lineTotal || 0), input.currency, input.locale))}
        </td>
      </tr>`;
    })
    .join("");

  const address = deliveryLines(input.delivery)
    .map((line) => escapeHtml(line))
    .join("<br />");

  const html = `<!doctype html>
<html>
  <body style="margin:0;background:#f4efe6;font-family:Arial,Helvetica,sans-serif;color:#1d1914;">
    <div style="padding:28px 14px;">
      <div style="max-width:640px;margin:0 auto;background:#fffdf8;border:1px solid #d8cfbf;">
        <div style="padding:26px 28px;border-bottom:1px solid #e1d8ca;">
          <div style="font-size:12px;font-weight:800;letter-spacing:.16em;color:#9b762c;">WHOKEAS ALL IN</div>
          <h1 style="margin:10px 0 0;font-family:Georgia,serif;font-weight:400;font-size:32px;line-height:1.2;">Order received</h1>
          <p style="margin:14px 0 0;color:#6f675c;line-height:1.7;font-size:14px;">Thank you, ${escapeHtml(input.customerName)}. We have received your order and reserved it while payment is being completed.</p>
        </div>

        <div style="padding:24px 28px;">
          <table role="presentation" style="width:100%;border-collapse:collapse;background:#f7f2e9;border:1px solid #ded5c7;">
            <tr>
              <td style="padding:14px 16px;font-size:12px;color:#746d62;">ORDER NUMBER<br /><strong style="display:inline-block;margin-top:5px;color:#1d1914;font-size:14px;">${escapeHtml(input.orderNumber)}</strong></td>
              <td style="padding:14px 16px;font-size:12px;color:#746d62;">PAYMENT STATUS<br /><strong style="display:inline-block;margin-top:5px;color:#1d1914;font-size:14px;">${escapeHtml(cleanStatus(input.paymentStatus))}</strong></td>
            </tr>
          </table>

          <h2 style="margin:26px 0 8px;font-size:18px;">Items</h2>
          <table role="presentation" style="width:100%;border-collapse:collapse;">${itemRows}</table>

          <table role="presentation" style="width:100%;border-collapse:collapse;margin-top:18px;">
            <tr>
              <td style="padding-top:14px;font-weight:800;font-size:17px;">Order total</td>
              <td style="padding-top:14px;text-align:right;font-weight:800;font-size:20px;color:#9b762c;">${escapeHtml(formatMoney(input.total, input.currency, input.locale))}</td>
            </tr>
          </table>

          <div style="margin-top:24px;padding:17px 18px;border:1px solid #ded5c7;background:#fff;">
            <div style="font-size:12px;font-weight:800;letter-spacing:.08em;color:#746d62;">DELIVERY DETAILS</div>
            <div style="margin-top:9px;font-size:14px;line-height:1.7;color:#514a40;">${address || "Saved with your order"}</div>
          </div>

          <div style="margin-top:26px;text-align:center;">
            <a href="${escapeHtml(orderUrl.toString())}" style="display:inline-block;background:#171512;color:#fff;text-decoration:none;padding:14px 22px;font-size:12px;font-weight:800;letter-spacing:.08em;">VIEW SECURE ORDER</a>
          </div>

          <p style="margin:24px 0 0;font-size:12px;line-height:1.7;color:#746d62;">For your security, WHOKEAS will never ask you to send card details by email, WhatsApp, text message or chat. Payment details should only be entered on the secure payment page linked from your WHOKEAS order.</p>
        </div>

        <div style="padding:18px 28px;border-top:1px solid #e1d8ca;background:#f7f2e9;color:#81796e;font-size:11px;line-height:1.6;">
          WHOKEAS ALL IN · U.S. online shopping · Free standard U.S. shipping
        </div>
      </div>
    </div>
  </body>
</html>`;

  const payload: Record<string, unknown> = {
    from: fromAddress(),
    to: [input.customerEmail],
    subject: `Order received · ${input.orderNumber}`,
    html,
  };

  const replyTo = process.env.ORDER_EMAIL_REPLY_TO?.trim();
  if (replyTo) payload.reply_to = replyTo;

  const bcc = process.env.ORDER_EMAIL_BCC?.trim();
  if (bcc) payload.bcc = [bcc];

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const result = (await response.json().catch(() => null)) as
    | { id?: string; message?: string; error?: string }
    | null;

  if (!response.ok) {
    throw new Error(
      result?.message || result?.error || "Could not send order confirmation email.",
    );
  }

  return {
    sent: true as const,
    id: String(result?.id || ""),
  };
}
