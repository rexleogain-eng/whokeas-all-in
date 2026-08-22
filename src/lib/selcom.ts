import { createHmac, timingSafeEqual } from "node:crypto";

const DEFAULT_BASE_URL = "https://apigw.selcommobile.com";

function apiKey() {
  return process.env.SELCOM_API_KEY?.trim() || "";
}

function apiSecret() {
  return process.env.SELCOM_API_SECRET?.trim() || "";
}

function vendorId() {
  return process.env.SELCOM_VENDOR_ID?.trim() || "";
}

function baseUrl() {
  return (process.env.SELCOM_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/$/, "");
}

export function selcomConfigured() {
  return Boolean(apiKey() && apiSecret() && vendorId());
}

function valueAtPath(payload: Record<string, unknown>, path: string) {
  const parts = path.split(".");
  let current: unknown = payload;

  for (const part of parts) {
    if (!current || typeof current !== "object") return "";
    current = (current as Record<string, unknown>)[part];
  }

  if (current === null || current === undefined) return "";
  if (typeof current === "object") return JSON.stringify(current);
  return String(current);
}

function digestFor(
  timestamp: string,
  signedFields: readonly string[],
  payload: Record<string, unknown>,
) {
  const signingString = [
    `timestamp=${timestamp}`,
    ...signedFields.map((field) => `${field}=${valueAtPath(payload, field)}`),
  ].join("&");

  return createHmac("sha256", apiSecret())
    .update(signingString, "utf8")
    .digest("base64");
}

function authHeaders(
  payload: Record<string, unknown>,
  signedFields: readonly string[],
) {
  if (!selcomConfigured()) {
    throw new Error("Selcom is not configured.");
  }

  const timestamp = new Date().toISOString();

  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `SELCOM ${Buffer.from(apiKey(), "utf8").toString("base64")}`,
    "Digest-Method": "HS256",
    Digest: digestFor(timestamp, signedFields, payload),
    Timestamp: timestamp,
    "Signed-Fields": signedFields.join(","),
  };
}

function encodeUrl(url: string) {
  return Buffer.from(url, "utf8").toString("base64");
}

function decodeGatewayUrl(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;

  try {
    const decoded = Buffer.from(raw, "base64").toString("utf8").trim();
    return /^https?:\/\//i.test(decoded) ? decoded : "";
  }
  catch {
    return "";
  }
}

function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || "Customer",
    lastName: parts.slice(1).join(" ") || "Customer",
  };
}

function cleanPhone(phone: string) {
  return phone.replace(/[^0-9]/g, "").slice(0, 20);
}

export type SelcomCreateOrderResponse = {
  reference?: string;
  resultcode?: string;
  result?: string;
  message?: string;
  data?: Array<{
    gateway_buyer_uuid?: string;
    payment_token?: string;
    qr?: string;
    payment_gateway_url?: string;
  }>;
};

export async function createSelcomCheckout(input: {
  orderId: string;
  amount: number;
  currency: string;
  customerEmail: string;
  customerName: string;
  customerPhone: string;
  redirectUrl: string;
  cancelUrl: string;
  webhookUrl: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  region?: string | null;
  postalCode?: string | null;
  countryCode: string;
  noOfItems: number;
}) {
  const { firstName, lastName } = splitName(input.customerName);
  const phone = cleanPhone(input.customerPhone);
  const addressLine2 = input.addressLine2 || "";
  const region = input.region || input.city;
  const postalCode = input.postalCode || "00000";
  const country = input.countryCode.toUpperCase();

  const payload: Record<string, unknown> = {
    vendor: vendorId(),
    order_id: input.orderId.slice(0, 40),
    buyer_email: input.customerEmail,
    buyer_name: input.customerName.slice(0, 160),
    buyer_userid: "",
    buyer_phone: phone,
    gateway_buyer_uuid: "",
    amount: Number(input.amount.toFixed(2)),
    currency: input.currency.toUpperCase(),
    payment_methods: "CARD",
    redirect_url: encodeUrl(input.redirectUrl),
    cancel_url: encodeUrl(input.cancelUrl),
    webhook: encodeUrl(input.webhookUrl),
    billing: {
      firstname: firstName,
      lastname: lastName,
      address_1: input.addressLine1,
      address_2: addressLine2,
      city: input.city,
      state_or_region: region,
      postcode_or_pobox: postalCode,
      country,
      phone,
    },
    shipping: {
      firstname: firstName,
      lastname: lastName,
      address_1: input.addressLine1,
      address_2: addressLine2,
      city: input.city,
      state_or_region: region,
      postcode_or_pobox: postalCode,
      country,
      phone,
    },
    buyer_remarks: `WHOKEAS order ${input.orderId}`,
    merchant_remarks: `WHOKEAS order ${input.orderId}`,
    no_of_items: Math.max(1, Math.floor(input.noOfItems || 1)),
    header_colour: "#171512",
    link_colour: "#9b762c",
    button_colour: "#008660",
    expiry: 60,
  };

  const signedFields = [
    "vendor",
    "order_id",
    "buyer_email",
    "buyer_name",
    "buyer_userid",
    "buyer_phone",
    "gateway_buyer_uuid",
    "amount",
    "currency",
    "payment_methods",
    "redirect_url",
    "cancel_url",
    "webhook",
    "billing.firstname",
    "billing.lastname",
    "billing.address_1",
    "billing.address_2",
    "billing.city",
    "billing.state_or_region",
    "billing.postcode_or_pobox",
    "billing.country",
    "billing.phone",
    "shipping.firstname",
    "shipping.lastname",
    "shipping.address_1",
    "shipping.address_2",
    "shipping.city",
    "shipping.state_or_region",
    "shipping.postcode_or_pobox",
    "shipping.country",
    "shipping.phone",
    "buyer_remarks",
    "merchant_remarks",
    "no_of_items",
  ] as const;

  const response = await fetch(`${baseUrl()}/v1/checkout/create-order`, {
    method: "POST",
    headers: authHeaders(payload, signedFields),
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const result = (await response.json().catch(() => null)) as SelcomCreateOrderResponse | null;
  const first = result?.data?.[0];
  const gatewayUrl = decodeGatewayUrl(first?.payment_gateway_url);

  if (
    !response.ok ||
    String(result?.resultcode || "") !== "000" ||
    String(result?.result || "").toUpperCase() !== "SUCCESS" ||
    !gatewayUrl
  ) {
    throw new Error(result?.message || "Could not start Selcom checkout.");
  }

  return {
    gatewayUrl,
    reference: String(result.reference || ""),
    gatewayBuyerUuid: String(first?.gateway_buyer_uuid || ""),
    paymentToken: String(first?.payment_token || ""),
    raw: result,
  };
}

export type SelcomOrderStatus = {
  reference?: string;
  resultcode?: string;
  result?: string;
  message?: string;
  data?: Array<{
    order_id?: string;
    creation_date?: string;
    amount?: string | number;
    payment_status?: string;
    transid?: string | null;
    channel?: string | null;
    reference?: string | null;
    phone?: string | null;
  }>;
};

export async function getSelcomOrderStatus(orderId: string) {
  const payload: Record<string, unknown> = {
    order_id: orderId.slice(0, 40),
  };
  const signedFields = ["order_id"] as const;
  const url = new URL(`${baseUrl()}/v1/checkout/order-status`);
  url.searchParams.set("order_id", String(payload.order_id));

  const response = await fetch(url, {
    method: "GET",
    headers: authHeaders(payload, signedFields),
    cache: "no-store",
  });

  const result = (await response.json().catch(() => null)) as SelcomOrderStatus | null;

  if (!response.ok || !result) {
    throw new Error(result?.message || "Could not verify Selcom payment status.");
  }

  return result;
}

export function verifySelcomWebhook(
  headers: Headers,
  payload: Record<string, unknown>,
) {
  if (!selcomConfigured()) return false;

  const authorization = headers.get("authorization") || "";
  const expectedAuthorization = `SELCOM ${Buffer.from(apiKey(), "utf8").toString("base64")}`;
  if (authorization !== expectedAuthorization) return false;

  const method = (headers.get("digest-method") || "").toUpperCase();
  if (method !== "HS256") return false;

  const timestamp = headers.get("timestamp") || "";
  const signedFields = (headers.get("signed-fields") || "")
    .split(",")
    .map((field) => field.trim())
    .filter(Boolean);
  const suppliedDigest = headers.get("digest") || "";

  if (!timestamp || signedFields.length === 0 || !suppliedDigest) return false;

  const expectedDigest = digestFor(timestamp, signedFields, payload);
  const supplied = Buffer.from(suppliedDigest, "utf8");
  const expected = Buffer.from(expectedDigest, "utf8");

  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
