import { createHmac, timingSafeEqual } from "node:crypto";

const FLUTTERWAVE_API = "https://api.flutterwave.com/v3";

function secretKey() {
  return process.env.FLW_SECRET_KEY?.trim() || "";
}

export function flutterwaveConfigured() {
  return Boolean(secretKey());
}

export type FlutterwaveVerifiedTransaction = {
  id: number | string;
  tx_ref: string;
  flw_ref?: string;
  amount: number;
  charged_amount?: number;
  currency: string;
  app_fee?: number;
  merchant_fee?: number;
  status: string;
  payment_type?: string;
  customer?: {
    email?: string;
    name?: string;
    phone_number?: string;
  };
  [key: string]: unknown;
};

type CheckoutInput = {
  txRef: string;
  amount: number;
  currency: string;
  customerEmail: string;
  customerName: string;
  customerPhone: string;
  redirectUrl: string;
  orderNumber: string;
};

export async function createFlutterwaveCheckout(input: CheckoutInput) {
  const key = secretKey();

  if (!key) {
    throw new Error("Flutterwave is not configured.");
  }

  const response = await fetch(`${FLUTTERWAVE_API}/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      tx_ref: input.txRef,
      amount: Number(input.amount.toFixed(2)),
      currency: input.currency,
      redirect_url: input.redirectUrl,
      payment_options: "card",
      customer: {
        email: input.customerEmail,
        name: input.customerName,
        phonenumber: input.customerPhone,
      },
      customizations: {
        title: "WHOKEAS ALL IN",
        description: `Payment for order ${input.orderNumber}`,
      },
      meta: {
        orderNumber: input.orderNumber,
        source: "whokeas.store",
      },
    }),
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null) as
    | {
        status?: string;
        message?: string;
        data?: { link?: string };
      }
    | null;

  const link = payload?.data?.link?.trim() || "";

  if (!response.ok || payload?.status !== "success" || !link) {
    throw new Error(
      payload?.message || "Could not start secure card payment.",
    );
  }

  return {
    link,
    raw: payload,
  };
}

export async function verifyFlutterwaveTransaction(
  transactionId: string | number,
) {
  const key = secretKey();

  if (!key) {
    throw new Error("Flutterwave is not configured.");
  }

  const id = encodeURIComponent(String(transactionId));
  const response = await fetch(
    `${FLUTTERWAVE_API}/transactions/${id}/verify`,
    {
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      cache: "no-store",
    },
  );

  const payload = await response.json().catch(() => null) as
    | {
        status?: string;
        message?: string;
        data?: FlutterwaveVerifiedTransaction | null;
      }
    | null;

  if (!response.ok || payload?.status !== "success" || !payload.data) {
    throw new Error(
      payload?.message || "Could not verify Flutterwave transaction.",
    );
  }

  return payload.data;
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function validFlutterwaveWebhookSignature(
  rawBody: string,
  signature: string | null,
  legacyHash: string | null,
) {
  const secretHash = process.env.FLW_SECRET_HASH?.trim() || "";

  if (!secretHash) return false;

  if (signature) {
    const expected = createHmac("sha256", secretHash)
      .update(rawBody)
      .digest("base64");

    if (safeEqual(signature, expected)) return true;
  }

  return Boolean(legacyHash && safeEqual(legacyHash, secretHash));
}
