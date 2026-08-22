const LIVE_BASE = "https://pay.pesapal.com/v3";
const SANDBOX_BASE = "https://cybqa.pesapal.com/pesapalv3";

function consumerKey() {
  return process.env.PESAPAL_CONSUMER_KEY?.trim() || "";
}

function consumerSecret() {
  return process.env.PESAPAL_CONSUMER_SECRET?.trim() || "";
}

function baseUrl() {
  return process.env.PESAPAL_ENV?.trim().toLowerCase() === "sandbox"
    ? SANDBOX_BASE
    : LIVE_BASE;
}

export function pesapalConfigured() {
  return Boolean(consumerKey() && consumerSecret());
}

async function requestToken() {
  if (!pesapalConfigured()) {
    throw new Error("Pesapal is not configured.");
  }

  const response = await fetch(`${baseUrl()}/api/Auth/RequestToken`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      consumer_key: consumerKey(),
      consumer_secret: consumerSecret(),
    }),
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as
    | { token?: string; message?: string; error?: { message?: string } }
    | null;

  const token = payload?.token?.trim() || "";

  if (!response.ok || !token) {
    throw new Error(
      payload?.error?.message || payload?.message || "Could not authenticate with Pesapal.",
    );
  }

  return token;
}

async function authedFetch(path: string, token: string, init?: RequestInit) {
  return fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
}

async function getOrRegisterIpn(token: string, url: string) {
  const listResponse = await authedFetch("/api/URLSetup/GetIpnList", token);
  const list = (await listResponse.json().catch(() => [])) as Array<{
    url?: string;
    ipn_id?: string;
    ipn_status?: number;
  }>;

  const existing = Array.isArray(list)
    ? list.find(
        (item) =>
          String(item.url || "").replace(/\/$/, "") === url.replace(/\/$/, "") &&
          item.ipn_id &&
          item.ipn_status !== 0,
      )
    : undefined;

  if (existing?.ipn_id) return String(existing.ipn_id);

  const response = await authedFetch("/api/URLSetup/RegisterIPN", token, {
    method: "POST",
    body: JSON.stringify({
      url,
      ipn_notification_type: "GET",
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | { ipn_id?: string; error?: { message?: string }; message?: string }
    | null;

  const ipnId = payload?.ipn_id?.trim() || "";

  if (!response.ok || !ipnId) {
    throw new Error(
      payload?.error?.message || payload?.message || "Could not register Pesapal IPN URL.",
    );
  }

  return ipnId;
}

export async function createPesapalCheckout(input: {
  merchantReference: string;
  amount: number;
  currency: string;
  description: string;
  callbackUrl: string;
  cancellationUrl: string;
  ipnUrl: string;
  customerEmail: string;
  customerPhone: string;
  customerName: string;
  countryCode: string;
  addressLine1?: string | null;
  city?: string | null;
}) {
  const token = await requestToken();
  const notificationId = await getOrRegisterIpn(token, input.ipnUrl);
  const names = input.customerName.trim().split(/\s+/).filter(Boolean);
  const firstName = names[0] || "Customer";
  const lastName = names.slice(1).join(" ") || "";

  const response = await authedFetch("/api/Transactions/SubmitOrderRequest", token, {
    method: "POST",
    body: JSON.stringify({
      id: input.merchantReference.slice(0, 50),
      currency: input.currency.toUpperCase(),
      amount: Number(input.amount.toFixed(2)),
      description: input.description.slice(0, 100),
      callback_url: input.callbackUrl,
      cancellation_url: input.cancellationUrl,
      redirect_mode: "TOP_WINDOW",
      notification_id: notificationId,
      branch: "WHOKEAS ALL IN",
      billing_address: {
        email_address: input.customerEmail,
        phone_number: input.customerPhone,
        country_code: input.countryCode.toUpperCase(),
        first_name: firstName,
        middle_name: "",
        last_name: lastName,
        line_1: input.addressLine1 || "",
        line_2: "",
        city: input.city || "",
        state: "",
        postal_code: "",
        zip_code: "",
      },
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | {
        order_tracking_id?: string;
        merchant_reference?: string;
        redirect_url?: string;
        error?: { message?: string };
        message?: string;
      }
    | null;

  const redirectUrl = payload?.redirect_url?.trim() || "";
  const trackingId = payload?.order_tracking_id?.trim() || "";

  if (!response.ok || !redirectUrl || !trackingId) {
    throw new Error(
      payload?.error?.message || payload?.message || "Could not start Pesapal checkout.",
    );
  }

  return {
    redirectUrl,
    trackingId,
    notificationId,
    raw: payload,
  };
}

export type PesapalTransactionStatus = {
  payment_method?: string;
  amount?: number;
  confirmation_code?: string;
  payment_status_description?: string;
  description?: string;
  merchant_reference?: string;
  currency?: string;
  status_code?: number;
  status?: string;
  [key: string]: unknown;
};

export async function getPesapalTransactionStatus(orderTrackingId: string) {
  const token = await requestToken();
  const id = encodeURIComponent(orderTrackingId);
  const response = await authedFetch(
    `/api/Transactions/GetTransactionStatus?orderTrackingId=${id}`,
    token,
  );

  const payload = (await response.json().catch(() => null)) as
    | PesapalTransactionStatus
    | null;

  if (!response.ok || !payload) {
    throw new Error("Could not verify Pesapal transaction status.");
  }

  return payload;
}
