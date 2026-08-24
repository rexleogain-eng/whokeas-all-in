import {
  createHmac,
  timingSafeEqual,
} from "node:crypto";

const BASE_URL = "https://api.clickpesa.com/third-parties";

function clientId() {
  return process.env.CLICKPESA_CLIENT_ID?.trim() || "";
}

function apiKey() {
  return process.env.CLICKPESA_API_KEY?.trim() || "";
}

function checksumKey() {
  return process.env.CLICKPESA_CHECKSUM_KEY?.trim() || "";
}

export function clickPesaConfigured() {
  return Boolean(clientId() && apiKey());
}

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  const record = value as Record<string, unknown>;

  return Object.keys(record)
    .sort()
    .reduce<Record<string, unknown>>((result, key) => {
      result[key] = canonicalize(record[key]);
      return result;
    }, {});
}

function payloadWithoutChecksum(
  payload: Record<string, unknown>,
) {
  const copy = { ...payload };
  delete copy.checksum;
  delete copy.checksumMethod;
  return copy;
}

export function createClickPesaChecksum(
  payload: Record<string, unknown>,
) {
  const secret = checksumKey();

  if (!secret) return "";

  const canonicalPayload = canonicalize(
    payloadWithoutChecksum(payload),
  );

  return createHmac("sha256", secret)
    .update(JSON.stringify(canonicalPayload))
    .digest("hex");
}

export function validateClickPesaChecksum(
  payload: Record<string, unknown>,
) {
  const secret = checksumKey();
  const received = String(payload.checksum || "")
    .trim()
    .toLowerCase();

  // ClickPesa checksum signing is optional. Payment state is still verified
  // server-to-server before WHOKEAS marks any order paid.
  if (!secret || !received) return true;

  const expected = createClickPesaChecksum(payload);

  if (
    expected.length !== received.length ||
    expected.length === 0
  ) {
    return false;
  }

  return timingSafeEqual(
    Buffer.from(expected, "utf8"),
    Buffer.from(received, "utf8"),
  );
}

async function requestToken() {
  if (!clickPesaConfigured()) {
    throw new Error("ClickPesa is not configured.");
  }

  const response = await fetch(
    `${BASE_URL}/generate-token`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "api-key": apiKey(),
        "client-id": clientId(),
      },
      cache: "no-store",
    },
  );

  const payload = (await response.json().catch(() => null)) as
    | {
        success?: boolean;
        token?: string;
        message?: string;
      }
    | null;

  const token = payload?.token?.trim() || "";

  if (!response.ok || !token) {
    throw new Error(
      payload?.message ||
        "Could not authenticate with ClickPesa.",
    );
  }

  return token.startsWith("Bearer ")
    ? token
    : `Bearer ${token}`;
}

async function authedFetch(
  path: string,
  token: string,
  init?: RequestInit,
) {
  return fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: token,
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, "").slice(0, 24);
}

export async function createClickPesaCheckout(input: {
  orderReference: string;
  amount: number;
  currency: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  description: string;
  callbackUrl: string;
}) {
  if (input.currency.toUpperCase() !== "USD") {
    throw new Error(
      "ClickPesa checkout is enabled only for WHOKEAS USD orders.",
    );
  }

  if (!/^[A-Za-z0-9]+$/.test(input.orderReference)) {
    throw new Error(
      "ClickPesa order reference must be alphanumeric.",
    );
  }

  const token = await requestToken();

  const body: Record<string, unknown> = {
    totalPrice: Number(input.amount.toFixed(2)).toFixed(2),
    orderReference: input.orderReference,
    orderCurrency: "USD",
    customerName: input.customerName.trim().slice(0, 160),
    customerEmail: input.customerEmail.trim().slice(0, 254),
    customerPhone: normalizePhone(input.customerPhone),
    description: input.description.trim().slice(0, 300),
    callbackUrl: input.callbackUrl,
  };

  const checksum = createClickPesaChecksum(body);
  if (checksum) body.checksum = checksum;

  const response = await authedFetch(
    "/checkout-link/generate-checkout-url",
    token,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );

  const payload = (await response.json().catch(() => null)) as
    | {
        checkoutLink?: string;
        clientId?: string;
        message?: string;
      }
    | null;

  const checkoutLink = payload?.checkoutLink?.trim() || "";

  if (!response.ok || !checkoutLink) {
    throw new Error(
      payload?.message ||
        "Could not start ClickPesa checkout.",
    );
  }

  return {
    checkoutLink,
    clientId: payload?.clientId || clientId(),
    raw: payload,
  };
}

export type ClickPesaPaymentStatus = {
  id?: string;
  status?: string;
  paymentReference?: string;
  orderReference?: string;
  collectedAmount?: number | string;
  collectedCurrency?: string;
  message?: string;
  updatedAt?: string;
  createdAt?: string;
  clientId?: string;
  [key: string]: unknown;
};

export async function getClickPesaPaymentStatus(
  orderReference: string,
) {
  const token = await requestToken();
  const reference = encodeURIComponent(orderReference);

  const response = await authedFetch(
    `/payments/${reference}`,
    token,
  );

  const payload = (await response.json().catch(() => null)) as
    | ClickPesaPaymentStatus[]
    | { message?: string }
    | null;

  if (!response.ok || !Array.isArray(payload)) {
    const message =
      payload && !Array.isArray(payload)
        ? payload.message
        : null;

    throw new Error(
      message ||
        "Could not verify ClickPesa payment status.",
    );
  }

  const records = payload
    .filter(
      (record) =>
        String(record.orderReference || "") === orderReference,
    )
    .sort((left, right) => {
      const leftTime = Date.parse(
        String(left.updatedAt || left.createdAt || 0),
      );
      const rightTime = Date.parse(
        String(right.updatedAt || right.createdAt || 0),
      );

      return (rightTime || 0) - (leftTime || 0);
    });

  if (!records[0]) {
    throw new Error(
      "ClickPesa did not return a payment for this WHOKEAS reference.",
    );
  }

  return records[0];
}
