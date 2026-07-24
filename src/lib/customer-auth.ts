import {
  createHash,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

import type { NextResponse } from "next/server";
import { cookies } from "next/headers";

import {
  catalogSql,
  ensureCatalogSchema,
} from "@/lib/catalog-schema";

export const CUSTOMER_COOKIE_NAME = "wai_customer";
export const CUSTOMER_SESSION_SECONDS = 60 * 60 * 24 * 30;

let customerSchemaPromise: Promise<void> | null = null;

export type CustomerIdentity = {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  countryCode: string;
  preferredCurrency: string;
  preferredLocale: string;
};

export type CustomerSession = {
  customer: CustomerIdentity;
  expiresAt: string;
};

function normalizeCountryCode(value: unknown) {
  const countryCode = String(value || "")
    .trim()
    .toUpperCase();

  return /^[A-Z]{2}$/.test(countryCode)
    ? countryCode
    : "TZ";
}

export function normalizeCustomerEmail(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .slice(0, 254);
}

export function validCustomerEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function validateCustomerPassword(password: string) {
  if (password.length < 8) {
    return "Password must contain at least 8 characters.";
  }

  if (password.length > 200) {
    return "Password is too long.";
  }

  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return "Password must include at least one letter and one number.";
  }

  return null;
}

export function hashCustomerPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(
    password.normalize("NFKC"),
    salt,
    64,
  ).toString("hex");

  return `scrypt-v1$${salt}$${derived}`;
}

export function verifyCustomerPassword(
  password: string,
  storedHash: string,
) {
  try {
    const [version, salt, expectedHex] = storedHash.split("$");

    if (
      version !== "scrypt-v1" ||
      !salt ||
      !expectedHex
    ) {
      return false;
    }

    const expected = Buffer.from(expectedHex, "hex");
    const actual = scryptSync(
      password.normalize("NFKC"),
      salt,
      expected.length,
    );

    return (
      expected.length === actual.length &&
      timingSafeEqual(expected, actual)
    );
  }
  catch {
    return false;
  }
}

function tokenHash(token: string) {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

export function hashOrderAccessKey(token: string) {
  return createHash("sha256")
    .update(`whokeas-order-access:${token}`)
    .digest("hex");
}

export function safeEqualHex(
  left: string | null | undefined,
  right: string | null | undefined,
) {
  if (!left || !right) return false;

  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export async function ensureCustomerSchema() {
  if (!customerSchemaPromise) {
    customerSchemaPromise = (async () => {
      await ensureCatalogSchema();

      const sql = catalogSql();

      await sql`
        CREATE TABLE IF NOT EXISTS customers (
          id uuid PRIMARY KEY,
          email varchar(254) NOT NULL UNIQUE,
          full_name varchar(160) NOT NULL,
          phone varchar(40),
          password_hash text NOT NULL,
          country_code varchar(2) NOT NULL DEFAULT 'TZ',
          preferred_currency varchar(3) NOT NULL DEFAULT 'TZS',
          preferred_locale varchar(20) NOT NULL DEFAULT 'en-TZ',
          email_verified boolean NOT NULL DEFAULT false,
          status varchar(24) NOT NULL DEFAULT 'active',
          failed_login_attempts integer NOT NULL DEFAULT 0,
          locked_until timestamptz,
          last_login_at timestamptz,
          created_at timestamptz NOT NULL DEFAULT NOW(),
          updated_at timestamptz NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS customer_sessions (
          id uuid PRIMARY KEY,
          customer_id uuid NOT NULL
            REFERENCES customers(id)
            ON DELETE CASCADE,
          token_hash varchar(64) NOT NULL UNIQUE,
          expires_at timestamptz NOT NULL,
          created_at timestamptz NOT NULL DEFAULT NOW(),
          last_seen_at timestamptz NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS customer_addresses (
          id uuid PRIMARY KEY,
          customer_id uuid NOT NULL
            REFERENCES customers(id)
            ON DELETE CASCADE,
          label varchar(80) NOT NULL DEFAULT 'Default',
          recipient_name varchar(160) NOT NULL,
          phone varchar(40) NOT NULL,
          country_code varchar(2) NOT NULL,
          country_name varchar(120) NOT NULL,
          region varchar(160),
          city varchar(160) NOT NULL,
          postal_code varchar(40),
          address_line_1 text NOT NULL,
          address_line_2 text,
          is_default boolean NOT NULL DEFAULT false,
          created_at timestamptz NOT NULL DEFAULT NOW(),
          updated_at timestamptz NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS customer_sessions_customer_idx
        ON customer_sessions (customer_id, expires_at)
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS customer_addresses_customer_idx
        ON customer_addresses (customer_id, is_default)
      `;

      await sql`
        ALTER TABLE orders
        ADD COLUMN IF NOT EXISTS customer_id uuid
      `;

      await sql`
        ALTER TABLE orders
        ADD COLUMN IF NOT EXISTS market_country_code varchar(2)
      `;

      await sql`
        ALTER TABLE orders
        ADD COLUMN IF NOT EXISTS customer_locale varchar(20)
      `;

      await sql`
        ALTER TABLE orders
        ADD COLUMN IF NOT EXISTS order_access_token_hash varchar(64)
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS orders_customer_idx
        ON orders (customer_id, created_at DESC)
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS orders_customer_email_idx
        ON orders (LOWER(customer_email))
      `;

      await sql`
        DELETE FROM customer_sessions
        WHERE expires_at <= NOW()
      `;
    })().catch((error) => {
      customerSchemaPromise = null;
      throw error;
    });
  }

  return customerSchemaPromise;
}

export async function createCustomerSession(
  customerId: string,
) {
  await ensureCustomerSchema();

  const sql = catalogSql();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(
    Date.now() + CUSTOMER_SESSION_SECONDS * 1000,
  );

  await sql`
    INSERT INTO customer_sessions (
      id,
      customer_id,
      token_hash,
      expires_at,
      created_at,
      last_seen_at
    )
    VALUES (
      ${randomUUID()},
      ${customerId},
      ${tokenHash(token)},
      ${expiresAt.toISOString()},
      NOW(),
      NOW()
    )
  `;

  return {
    token,
    expiresAt,
  };
}

export function setCustomerSessionCookie(
  response: NextResponse,
  token: string,
) {
  response.cookies.set({
    name: CUSTOMER_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: CUSTOMER_SESSION_SECONDS,
  });
}

export function clearCustomerSessionCookie(
  response: NextResponse,
) {
  response.cookies.set({
    name: CUSTOMER_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function getCustomerSession():
  Promise<CustomerSession | null> {
  await ensureCustomerSchema();

  const cookieStore = await cookies();
  const rawToken =
    cookieStore.get(CUSTOMER_COOKIE_NAME)?.value;

  if (!rawToken) return null;

  const sql = catalogSql();

  const rows = await sql`
    SELECT
      customer.id::text AS id,
      customer.email,
      customer.full_name AS "fullName",
      customer.phone,
      customer.country_code AS "countryCode",
      customer.preferred_currency AS "preferredCurrency",
      customer.preferred_locale AS "preferredLocale",
      session.expires_at AS "expiresAt"
    FROM customer_sessions session
    INNER JOIN customers customer
      ON customer.id = session.customer_id
    WHERE session.token_hash = ${tokenHash(rawToken)}
      AND session.expires_at > NOW()
      AND customer.status = 'active'
    LIMIT 1
  `;

  const row = rows[0];

  if (!row?.id) return null;

  await sql`
    UPDATE customer_sessions
    SET last_seen_at = NOW()
    WHERE token_hash = ${tokenHash(rawToken)}
  `;

  return {
    customer: {
      id: String(row.id),
      email: String(row.email),
      fullName: String(row.fullName),
      phone: row.phone ? String(row.phone) : null,
      countryCode: normalizeCountryCode(row.countryCode),
      preferredCurrency: String(
        row.preferredCurrency || "TZS",
      ),
      preferredLocale: String(
        row.preferredLocale || "en-TZ",
      ),
    },
    expiresAt: new Date(
      String(row.expiresAt),
    ).toISOString(),
  };
}

export async function destroyCurrentCustomerSession() {
  await ensureCustomerSchema();

  const cookieStore = await cookies();
  const rawToken =
    cookieStore.get(CUSTOMER_COOKIE_NAME)?.value;

  if (!rawToken) return;

  const sql = catalogSql();

  await sql`
    DELETE FROM customer_sessions
    WHERE token_hash = ${tokenHash(rawToken)}
  `;
}

export async function linkGuestOrders(
  customerId: string,
  email: string,
) {
  await ensureCustomerSchema();

  const sql = catalogSql();

  await sql`
    UPDATE orders
    SET
      customer_id = ${customerId},
      updated_at = NOW()
    WHERE customer_id IS NULL
      AND LOWER(COALESCE(customer_email, '')) =
        ${normalizeCustomerEmail(email)}
  `;
}

export async function updateCustomerProfile(input: {
  customerId: string;
  fullName: string;
  phone: string;
  countryCode: string;
  currency: string;
  locale: string;
}) {
  await ensureCustomerSchema();

  const sql = catalogSql();

  await sql`
    UPDATE customers
    SET
      full_name = ${input.fullName},
      phone = ${input.phone},
      country_code = ${normalizeCountryCode(input.countryCode)},
      preferred_currency = ${input.currency.toUpperCase()},
      preferred_locale = ${input.locale},
      updated_at = NOW()
    WHERE id = ${input.customerId}
  `;
}

export async function saveDefaultCustomerAddress(input: {
  customerId: string;
  recipientName: string;
  phone: string;
  countryCode: string;
  countryName: string;
  region: string;
  city: string;
  postalCode: string;
  addressLine1: string;
  addressLine2: string;
}) {
  await ensureCustomerSchema();

  const sql = catalogSql();

  const current = await sql`
    SELECT id::text AS id
    FROM customer_addresses
    WHERE customer_id = ${input.customerId}
      AND is_default = TRUE
    ORDER BY updated_at DESC
    LIMIT 1
  `;

  if (current[0]?.id) {
    await sql`
      UPDATE customer_addresses
      SET
        recipient_name = ${input.recipientName},
        phone = ${input.phone},
        country_code = ${normalizeCountryCode(input.countryCode)},
        country_name = ${input.countryName},
        region = ${input.region || null},
        city = ${input.city},
        postal_code = ${input.postalCode || null},
        address_line_1 = ${input.addressLine1},
        address_line_2 = ${input.addressLine2 || null},
        updated_at = NOW()
      WHERE id = ${String(current[0].id)}
    `;

    return;
  }

  await sql`
    INSERT INTO customer_addresses (
      id,
      customer_id,
      label,
      recipient_name,
      phone,
      country_code,
      country_name,
      region,
      city,
      postal_code,
      address_line_1,
      address_line_2,
      is_default,
      created_at,
      updated_at
    )
    VALUES (
      ${randomUUID()},
      ${input.customerId},
      'Default',
      ${input.recipientName},
      ${input.phone},
      ${normalizeCountryCode(input.countryCode)},
      ${input.countryName},
      ${input.region || null},
      ${input.city},
      ${input.postalCode || null},
      ${input.addressLine1},
      ${input.addressLine2 || null},
      TRUE,
      NOW(),
      NOW()
    )
  `;
}