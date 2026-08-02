import {
  randomBytes,
  randomUUID,
} from "node:crypto";

import {
  catalogSql,
} from "@/lib/catalog-schema";

import {
  ensureCustomerSchema,
} from "@/lib/customer-auth";

export type GrowthAdjustment = {
  promotionCode: string | null;
  couponId: string | null;
  couponCode: string | null;
  couponDiscount: number;
  affiliateId: string | null;
  affiliateCode: string | null;
  affiliateRate: number;
  referrerCustomerId: string | null;
  referralCode: string | null;
  referralDiscount: number;
  referralReward: number;
  storeCreditUsed: number;
  discountAmount: number;
  total: number;
};

export class GrowthPricingError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "GrowthPricingError";
    this.status = status;
  }
}

let growthSchemaPromise: Promise<void> | null = null;

function clean(value: unknown, maximum = 300) {
  return typeof value === "string"
    ? value.trim().slice(0, maximum)
    : "";
}

export function normalizeGrowthCode(value: unknown) {
  return clean(value, 40)
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "");
}

function roundMoney(value: number) {
  return Math.round(
    (Number(value || 0) + Number.EPSILON) * 100,
  ) / 100;
}

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function generateReadableCode(prefix: string) {
  return `${prefix}-${randomBytes(4)
    .toString("hex")
    .toUpperCase()}`;
}

export async function ensureGrowthSchema() {
  if (!growthSchemaPromise) {
    growthSchemaPromise = (async () => {
      await ensureCustomerSchema();

      const sql = catalogSql();

      await sql`
        ALTER TABLE customers
        ADD COLUMN IF NOT EXISTS referral_code varchar(32)
      `;

      await sql`
        CREATE UNIQUE INDEX IF NOT EXISTS customers_referral_code_uidx
        ON customers (referral_code)
        WHERE referral_code IS NOT NULL
      `;

      await sql`
        UPDATE customers
        SET referral_code =
          'WAI-' ||
          UPPER(
            SUBSTRING(
              REPLACE(id::text, '-', ''),
              1,
              8
            )
          )
        WHERE referral_code IS NULL
      `;

      await sql`
        CREATE OR REPLACE FUNCTION assign_whokeas_referral_code()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        BEGIN
          IF NEW.referral_code IS NULL OR BTRIM(NEW.referral_code) = '' THEN
            NEW.referral_code :=
              'WAI-' ||
              UPPER(
                SUBSTRING(
                  REPLACE(NEW.id::text, '-', ''),
                  1,
                  8
                )
              );
          END IF;

          RETURN NEW;
        END;
        $$
      `;

      await sql`
        DROP TRIGGER IF EXISTS customers_assign_referral_code
        ON customers
      `;

      await sql`
        CREATE TRIGGER customers_assign_referral_code
        BEFORE INSERT ON customers
        FOR EACH ROW
        EXECUTE FUNCTION assign_whokeas_referral_code()
      `;

      await sql`
        ALTER TABLE orders
        ADD COLUMN IF NOT EXISTS coupon_code varchar(40)
      `;

      await sql`
        ALTER TABLE orders
        ADD COLUMN IF NOT EXISTS attribution_code varchar(40)
      `;

      await sql`
        ALTER TABLE orders
        ADD COLUMN IF NOT EXISTS affiliate_id uuid
      `;

      await sql`
        ALTER TABLE orders
        ADD COLUMN IF NOT EXISTS referrer_customer_id uuid
      `;

      await sql`
        ALTER TABLE orders
        ADD COLUMN IF NOT EXISTS store_credit_used numeric(14,2)
          NOT NULL DEFAULT 0
      `;

      await sql`
        ALTER TABLE orders
        ADD COLUMN IF NOT EXISTS growth_metadata jsonb
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS growth_settings (
          key varchar(80) PRIMARY KEY,
          value_json jsonb NOT NULL,
          updated_at timestamptz NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        INSERT INTO growth_settings (
          key,
          value_json,
          updated_at
        )
        VALUES
          (
            'referral_new_customer_discount_tzs',
            '2000'::jsonb,
            NOW()
          ),
          (
            'referral_reward_tzs',
            '2000'::jsonb,
            NOW()
          ),
          (
            'max_store_credit_percent',
            '50'::jsonb,
            NOW()
          ),
          (
            'minimum_growth_profit_margin_percent',
            '10'::jsonb,
            NOW()
          ),
          (
            'estimated_payment_fee_percent',
            '3'::jsonb,
            NOW()
          ),
          (
            'referral_minimum_order_tzs',
            '20000'::jsonb,
            NOW()
          )
        ON CONFLICT (key) DO NOTHING
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS growth_coupons (
          id uuid PRIMARY KEY,
          code varchar(40) NOT NULL UNIQUE,
          name varchar(160) NOT NULL,
          discount_type varchar(20) NOT NULL,
          discount_value numeric(14,2) NOT NULL,
          maximum_discount numeric(14,2),
          minimum_order numeric(14,2) NOT NULL DEFAULT 0,
          currency varchar(3) NOT NULL DEFAULT 'TZS',
          usage_limit integer,
          per_customer_limit integer NOT NULL DEFAULT 1,
          is_active boolean NOT NULL DEFAULT true,
          starts_at timestamptz,
          expires_at timestamptz,
          created_at timestamptz NOT NULL DEFAULT NOW(),
          updated_at timestamptz NOT NULL DEFAULT NOW(),
          CHECK (
            discount_type IN ('percent', 'fixed')
          ),
          CHECK (discount_value > 0),
          CHECK (
            per_customer_limit >= 1
          )
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS growth_affiliates (
          id uuid PRIMARY KEY,
          name varchar(160) NOT NULL,
          code varchar(40) NOT NULL UNIQUE,
          email varchar(254),
          phone varchar(40),
          commission_rate numeric(7,3) NOT NULL DEFAULT 5,
          status varchar(20) NOT NULL DEFAULT 'active',
          notes text,
          created_at timestamptz NOT NULL DEFAULT NOW(),
          updated_at timestamptz NOT NULL DEFAULT NOW(),
          CHECK (
            commission_rate >= 0
            AND commission_rate <= 40
          ),
          CHECK (
            status IN ('active', 'paused', 'blocked')
          )
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS growth_clicks (
          id uuid PRIMARY KEY,
          attribution_code varchar(40) NOT NULL,
          affiliate_id uuid
            REFERENCES growth_affiliates(id)
            ON DELETE SET NULL,
          visitor_id varchar(80) NOT NULL,
          landing_path text,
          referrer text,
          created_at timestamptz NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE UNIQUE INDEX IF NOT EXISTS growth_clicks_code_visitor_uidx
        ON growth_clicks (
          attribution_code,
          visitor_id
        )
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS growth_clicks_created_idx
        ON growth_clicks (created_at DESC)
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS growth_coupon_redemptions (
          id uuid PRIMARY KEY,
          coupon_id uuid NOT NULL
            REFERENCES growth_coupons(id)
            ON DELETE CASCADE,
          order_id uuid NOT NULL UNIQUE
            REFERENCES orders(id)
            ON DELETE CASCADE,
          customer_id uuid
            REFERENCES customers(id)
            ON DELETE SET NULL,
          customer_email varchar(254),
          amount numeric(14,2) NOT NULL,
          currency varchar(3) NOT NULL,
          status varchar(20) NOT NULL DEFAULT 'reserved',
          created_at timestamptz NOT NULL DEFAULT NOW(),
          updated_at timestamptz NOT NULL DEFAULT NOW(),
          CHECK (
            status IN ('reserved', 'redeemed', 'void')
          )
        )
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS growth_coupon_redemptions_coupon_idx
        ON growth_coupon_redemptions (
          coupon_id,
          status,
          created_at DESC
        )
      `;

      await sql`
        CREATE OR REPLACE FUNCTION enforce_growth_coupon_limits()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        DECLARE
          configured_usage_limit integer;
          configured_customer_limit integer;
          current_usage integer;
          current_customer_usage integer;
        BEGIN
          PERFORM pg_advisory_xact_lock(
            hashtext(NEW.coupon_id::text)
          );

          SELECT
            usage_limit,
            per_customer_limit
          INTO
            configured_usage_limit,
            configured_customer_limit
          FROM growth_coupons
          WHERE id = NEW.coupon_id
            AND is_active = true
            AND (starts_at IS NULL OR starts_at <= NOW())
            AND (expires_at IS NULL OR expires_at >= NOW());

          IF NOT FOUND THEN
            RAISE EXCEPTION
              'Coupon is inactive, expired or unavailable.';
          END IF;

          SELECT COUNT(*)::int
          INTO current_usage
          FROM growth_coupon_redemptions
          WHERE coupon_id = NEW.coupon_id
            AND (
              status = 'redeemed'
              OR (
                status = 'reserved'
                AND created_at > NOW() - INTERVAL '24 hours'
              )
            );

          IF configured_usage_limit IS NOT NULL
             AND current_usage >= configured_usage_limit THEN
            RAISE EXCEPTION
              'Coupon usage limit has been reached.';
          END IF;

          IF NEW.customer_id IS NOT NULL THEN
            SELECT COUNT(*)::int
            INTO current_customer_usage
            FROM growth_coupon_redemptions
            WHERE coupon_id = NEW.coupon_id
              AND customer_id = NEW.customer_id
              AND status IN ('reserved', 'redeemed');
          ELSIF NEW.customer_email IS NOT NULL THEN
            SELECT COUNT(*)::int
            INTO current_customer_usage
            FROM growth_coupon_redemptions
            WHERE coupon_id = NEW.coupon_id
              AND LOWER(customer_email) = LOWER(NEW.customer_email)
              AND status IN ('reserved', 'redeemed');
          ELSE
            current_customer_usage := 0;
          END IF;

          IF current_customer_usage >= configured_customer_limit THEN
            RAISE EXCEPTION
              'Coupon customer usage limit has been reached.';
          END IF;

          RETURN NEW;
        END;
        $$
      `;

      await sql`
        DROP TRIGGER IF EXISTS growth_coupon_limits_guard
        ON growth_coupon_redemptions
      `;

      await sql`
        CREATE TRIGGER growth_coupon_limits_guard
        BEFORE INSERT ON growth_coupon_redemptions
        FOR EACH ROW
        EXECUTE FUNCTION enforce_growth_coupon_limits()
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS growth_affiliate_commissions (
          id uuid PRIMARY KEY,
          affiliate_id uuid NOT NULL
            REFERENCES growth_affiliates(id)
            ON DELETE CASCADE,
          order_id uuid NOT NULL UNIQUE
            REFERENCES orders(id)
            ON DELETE CASCADE,
          order_number varchar(40) NOT NULL,
          revenue_amount numeric(14,2) NOT NULL,
          commission_rate numeric(7,3) NOT NULL,
          commission_amount numeric(14,2) NOT NULL,
          currency varchar(3) NOT NULL,
          status varchar(24) NOT NULL DEFAULT 'pending_payment',
          created_at timestamptz NOT NULL DEFAULT NOW(),
          approved_at timestamptz,
          paid_at timestamptz,
          updated_at timestamptz NOT NULL DEFAULT NOW(),
          CHECK (
            status IN (
              'pending_payment',
              'pending',
              'approved',
              'paid',
              'void'
            )
          )
        )
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS growth_affiliate_commissions_status_idx
        ON growth_affiliate_commissions (
          status,
          created_at DESC
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS growth_referral_claims (
          id uuid PRIMARY KEY,
          referrer_customer_id uuid NOT NULL
            REFERENCES customers(id)
            ON DELETE CASCADE,
          referred_customer_id uuid
            REFERENCES customers(id)
            ON DELETE SET NULL,
          referred_email varchar(254),
          order_id uuid NOT NULL UNIQUE
            REFERENCES orders(id)
            ON DELETE CASCADE,
          order_number varchar(40) NOT NULL,
          discount_amount numeric(14,2) NOT NULL DEFAULT 0,
          reward_amount numeric(14,2) NOT NULL DEFAULT 0,
          currency varchar(3) NOT NULL DEFAULT 'TZS',
          status varchar(24) NOT NULL DEFAULT 'pending_payment',
          created_at timestamptz NOT NULL DEFAULT NOW(),
          rewarded_at timestamptz,
          updated_at timestamptz NOT NULL DEFAULT NOW(),
          CHECK (
            status IN (
              'pending_payment',
              'pending',
              'rewarded',
              'void'
            )
          )
        )
      `;

      await sql`
        CREATE UNIQUE INDEX IF NOT EXISTS growth_referral_customer_uidx
        ON growth_referral_claims (referred_customer_id)
        WHERE referred_customer_id IS NOT NULL
          AND status <> 'void'
      `;

      await sql`
        CREATE UNIQUE INDEX IF NOT EXISTS growth_referral_email_uidx
        ON growth_referral_claims (LOWER(referred_email))
        WHERE referred_email IS NOT NULL
          AND status <> 'void'
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS growth_store_credit_transactions (
          id uuid PRIMARY KEY,
          customer_id uuid NOT NULL
            REFERENCES customers(id)
            ON DELETE CASCADE,
          order_id uuid
            REFERENCES orders(id)
            ON DELETE SET NULL,
          amount numeric(14,2) NOT NULL,
          currency varchar(3) NOT NULL DEFAULT 'TZS',
          kind varchar(32) NOT NULL,
          status varchar(20) NOT NULL DEFAULT 'posted',
          description text,
          created_at timestamptz NOT NULL DEFAULT NOW(),
          updated_at timestamptz NOT NULL DEFAULT NOW(),
          CHECK (
            status IN ('pending', 'posted', 'void')
          )
        )
      `;

      await sql`
        CREATE UNIQUE INDEX IF NOT EXISTS growth_store_credit_order_kind_uidx
        ON growth_store_credit_transactions (
          order_id,
          kind
        )
        WHERE order_id IS NOT NULL
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS growth_store_credit_customer_idx
        ON growth_store_credit_transactions (
          customer_id,
          status,
          created_at DESC
        )
      `;

      await sql`
        CREATE OR REPLACE FUNCTION enforce_growth_credit_balance()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        DECLARE
          current_balance numeric(14,2);
        BEGIN
          IF NEW.kind <> 'order_redemption'
             OR NEW.amount >= 0
             OR NEW.status NOT IN ('pending', 'posted') THEN
            RETURN NEW;
          END IF;

          PERFORM pg_advisory_xact_lock(
            hashtext(NEW.customer_id::text)
          );

          IF TG_OP = 'UPDATE' THEN
            SELECT COALESCE(
              SUM(
                CASE
                  WHEN status = 'posted' THEN amount
                  WHEN status = 'pending' AND amount < 0 THEN amount
                  ELSE 0
                END
              ),
              0
            )
            INTO current_balance
            FROM growth_store_credit_transactions
            WHERE customer_id = NEW.customer_id
              AND currency = NEW.currency
              AND id <> OLD.id;
          ELSE
            SELECT COALESCE(
              SUM(
                CASE
                  WHEN status = 'posted' THEN amount
                  WHEN status = 'pending' AND amount < 0 THEN amount
                  ELSE 0
                END
              ),
              0
            )
            INTO current_balance
            FROM growth_store_credit_transactions
            WHERE customer_id = NEW.customer_id
              AND currency = NEW.currency;
          END IF;

          IF current_balance + NEW.amount < 0 THEN
            RAISE EXCEPTION
              'Insufficient WHOKEAS store credit balance.';
          END IF;

          RETURN NEW;
        END;
        $$
      `;

      await sql`
        DROP TRIGGER IF EXISTS growth_credit_balance_guard
        ON growth_store_credit_transactions
      `;

      await sql`
        CREATE TRIGGER growth_credit_balance_guard
        BEFORE INSERT OR UPDATE OF amount, status
        ON growth_store_credit_transactions
        FOR EACH ROW
        EXECUTE FUNCTION enforce_growth_credit_balance()
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS growth_abandoned_checkouts (
          id uuid PRIMARY KEY,
          recovery_token varchar(64) NOT NULL UNIQUE,
          customer_name varchar(160),
          customer_email varchar(254),
          customer_phone varchar(40),
          country_code varchar(2),
          currency varchar(3),
          estimated_total numeric(14,2) NOT NULL DEFAULT 0,
          promotion_code varchar(40),
          cart jsonb NOT NULL DEFAULT '[]'::jsonb,
          status varchar(24) NOT NULL DEFAULT 'open',
          order_id uuid
            REFERENCES orders(id)
            ON DELETE SET NULL,
          first_seen_at timestamptz NOT NULL DEFAULT NOW(),
          last_seen_at timestamptz NOT NULL DEFAULT NOW(),
          contacted_at timestamptz,
          recovered_at timestamptz,
          closed_at timestamptz,
          CHECK (
            status IN (
              'open',
              'contacted',
              'recovered',
              'closed'
            )
          )
        )
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS growth_abandoned_status_idx
        ON growth_abandoned_checkouts (
          status,
          last_seen_at DESC
        )
      `;

      await sql`
        UPDATE growth_coupon_redemptions redemption
        SET
          status = 'void',
          updated_at = NOW()
        FROM orders order_record
        WHERE redemption.order_id = order_record.id
          AND redemption.status = 'reserved'
          AND order_record.status::text = 'pending_payment'
          AND order_record.created_at < NOW() - INTERVAL '48 hours'
      `;

      await sql`
        UPDATE growth_store_credit_transactions transaction_record
        SET
          status = 'void',
          updated_at = NOW()
        FROM orders order_record
        WHERE transaction_record.order_id = order_record.id
          AND transaction_record.kind = 'order_redemption'
          AND transaction_record.status = 'pending'
          AND order_record.status::text = 'pending_payment'
          AND order_record.created_at < NOW() - INTERVAL '48 hours'
      `;
    })().catch((error) => {
      growthSchemaPromise = null;
      throw error;
    });
  }

  return growthSchemaPromise;
}

async function settingNumber(
  key: string,
  fallback: number,
) {
  const sql = catalogSql();

  const rows = await sql`
    SELECT value_json
    FROM growth_settings
    WHERE key = ${key}
    LIMIT 1
  `;

  return numberValue(rows[0]?.value_json, fallback);
}

export async function getCustomerGrowthBenefits(
  customerId: string,
) {
  await ensureGrowthSchema();

  const sql = catalogSql();

  const [customerRows, balanceRows] = await Promise.all([
    sql`
      SELECT
        referral_code AS "referralCode"
      FROM customers
      WHERE id = ${customerId}
      LIMIT 1
    `,
    sql`
      SELECT
        COALESCE(
          SUM(
            CASE
              WHEN status = 'posted' THEN amount
              WHEN status = 'pending' AND amount < 0 THEN amount
              ELSE 0
            END
          ),
          0
        )::text AS balance
      FROM growth_store_credit_transactions
      WHERE customer_id = ${customerId}
        AND currency = 'TZS'
    `,
  ]);

  return {
    referralCode:
      clean(customerRows[0]?.referralCode, 32) || null,
    storeCreditBalance: Math.max(
      0,
      roundMoney(numberValue(balanceRows[0]?.balance)),
    ),
  };
}

async function resolveCoupon(input: {
  code: string;
  subtotal: number;
  currency: string;
  customerId: string | null;
  customerEmail: string;
}) {
  if (!input.code) return null;

  const sql = catalogSql();

  const rows = await sql`
    SELECT
      id::text AS id,
      code,
      name,
      discount_type AS "discountType",
      discount_value::text AS "discountValue",
      maximum_discount::text AS "maximumDiscount",
      minimum_order::text AS "minimumOrder",
      currency,
      usage_limit AS "usageLimit",
      per_customer_limit AS "perCustomerLimit",
      is_active AS "active",
      starts_at AS "startsAt",
      expires_at AS "expiresAt"
    FROM growth_coupons
    WHERE code = ${input.code}
    LIMIT 1
  `;

  const coupon = rows[0];

  if (!coupon) return null;

  if (coupon.active !== true) {
    throw new GrowthPricingError(
      "This coupon is currently inactive.",
      409,
    );
  }

  const now = Date.now();

  if (
    coupon.startsAt &&
    new Date(String(coupon.startsAt)).getTime() > now
  ) {
    throw new GrowthPricingError(
      "This coupon has not started yet.",
      409,
    );
  }

  if (
    coupon.expiresAt &&
    new Date(String(coupon.expiresAt)).getTime() < now
  ) {
    throw new GrowthPricingError(
      "This coupon has expired.",
      409,
    );
  }

  const couponCurrency = clean(coupon.currency, 3).toUpperCase();

  if (couponCurrency !== input.currency) {
    throw new GrowthPricingError(
      `This coupon is available only for ${couponCurrency} orders.`,
      409,
    );
  }

  if (
    input.subtotal <
    numberValue(coupon.minimumOrder)
  ) {
    throw new GrowthPricingError(
      `This coupon requires a minimum order of ${couponCurrency} ${numberValue(
        coupon.minimumOrder,
      ).toLocaleString("en-US")}.`,
      409,
    );
  }

  const usageRows = await sql`
    SELECT COUNT(*)::int AS count
    FROM growth_coupon_redemptions
    WHERE coupon_id = ${String(coupon.id)}
      AND (
        status = 'redeemed'
        OR (
          status = 'reserved'
          AND created_at > NOW() - INTERVAL '24 hours'
        )
      )
  `;

  const totalUsage = numberValue(usageRows[0]?.count);

  if (
    coupon.usageLimit !== null &&
    totalUsage >= numberValue(coupon.usageLimit)
  ) {
    throw new GrowthPricingError(
      "This coupon has reached its usage limit.",
      409,
    );
  }

  const customerUsageRows = input.customerId
    ? await sql`
        SELECT COUNT(*)::int AS count
        FROM growth_coupon_redemptions
        WHERE coupon_id = ${String(coupon.id)}
          AND customer_id = ${input.customerId}
          AND status IN ('reserved', 'redeemed')
      `
    : input.customerEmail
      ? await sql`
          SELECT COUNT(*)::int AS count
          FROM growth_coupon_redemptions
          WHERE coupon_id = ${String(coupon.id)}
            AND LOWER(customer_email) =
              LOWER(${input.customerEmail})
            AND status IN ('reserved', 'redeemed')
        `
      : [];

  if (
    customerUsageRows[0] &&
    numberValue(customerUsageRows[0].count) >=
      numberValue(coupon.perCustomerLimit, 1)
  ) {
    throw new GrowthPricingError(
      "This coupon has already been used for this customer.",
      409,
    );
  }

  const discountValue = numberValue(coupon.discountValue);
  let discount =
    String(coupon.discountType) === "percent"
      ? input.subtotal * (discountValue / 100)
      : discountValue;

  const maximumDiscount = numberValue(
    coupon.maximumDiscount,
  );

  if (maximumDiscount > 0) {
    discount = Math.min(discount, maximumDiscount);
  }

  discount = roundMoney(
    Math.min(input.subtotal, Math.max(0, discount)),
  );

  return {
    id: String(coupon.id),
    code: String(coupon.code),
    discount,
  };
}

async function resolveAttribution(input: {
  code: string;
  currency: string;
  subtotal: number;
  customerId: string | null;
  customerEmail: string;
}) {
  if (!input.code) {
    return {
      affiliateId: null,
      affiliateCode: null,
      affiliateRate: 0,
      referrerCustomerId: null,
      referralCode: null,
      referralDiscount: 0,
      referralReward: 0,
    };
  }

  const sql = catalogSql();

  const affiliateRows = await sql`
    SELECT
      id::text AS id,
      code,
      commission_rate::text AS "commissionRate"
    FROM growth_affiliates
    WHERE code = ${input.code}
      AND status = 'active'
    LIMIT 1
  `;

  const affiliate = affiliateRows[0];

  if (affiliate) {
    return {
      affiliateId: String(affiliate.id),
      affiliateCode: String(affiliate.code),
      affiliateRate: Math.max(
        0,
        Math.min(
          40,
          numberValue(affiliate.commissionRate),
        ),
      ),
      referrerCustomerId: null,
      referralCode: null,
      referralDiscount: 0,
      referralReward: 0,
    };
  }

  const referrerRows = await sql`
    SELECT
      id::text AS id,
      email,
      referral_code AS "referralCode"
    FROM customers
    WHERE referral_code = ${input.code}
      AND status = 'active'
    LIMIT 1
  `;

  const referrer = referrerRows[0];

  if (!referrer) {
    return {
      affiliateId: null,
      affiliateCode: null,
      affiliateRate: 0,
      referrerCustomerId: null,
      referralCode: null,
      referralDiscount: 0,
      referralReward: 0,
    };
  }

  if (
    input.customerId &&
    input.customerId === String(referrer.id)
  ) {
    throw new GrowthPricingError(
      "You cannot use your own referral code.",
      409,
    );
  }

  if (
    input.customerEmail &&
    clean(referrer.email, 254).toLowerCase() ===
      input.customerEmail.toLowerCase()
  ) {
    throw new GrowthPricingError(
      "You cannot use your own referral code.",
      409,
    );
  }

  const previousOrders = input.customerId
    ? await sql`
        SELECT COUNT(*)::int AS count
        FROM orders
        WHERE customer_id = ${input.customerId}
          AND status::text NOT IN (
            'cancelled',
            'refunded'
          )
      `
    : input.customerEmail
      ? await sql`
          SELECT COUNT(*)::int AS count
          FROM orders
          WHERE LOWER(customer_email) =
            LOWER(${input.customerEmail})
            AND status::text NOT IN (
              'cancelled',
              'refunded'
            )
        `
      : [];

  if (
    previousOrders[0] &&
    numberValue(previousOrders[0].count) > 0
  ) {
    throw new GrowthPricingError(
      "Referral discounts are available only on a customer's first order.",
      409,
    );
  }

  if (input.currency === "TZS") {
    const minimumOrder =
      await settingNumber(
        "referral_minimum_order_tzs",
        20000,
      );

    if (input.subtotal < minimumOrder) {
      throw new GrowthPricingError(
        `Referral discounts require a minimum order of TZS ${Math.round(
          minimumOrder,
        ).toLocaleString("en-US")}.`,
        409,
      );
    }
  }

  const referralDiscount =
    input.currency === "TZS"
      ? await settingNumber(
          "referral_new_customer_discount_tzs",
          2000,
        )
      : 0;

  const referralReward =
    input.currency === "TZS"
      ? await settingNumber(
          "referral_reward_tzs",
          2000,
        )
      : 0;

  return {
    affiliateId: null,
    affiliateCode: null,
    affiliateRate: 0,
    referrerCustomerId: String(referrer.id),
    referralCode: String(referrer.referralCode),
    referralDiscount: Math.max(
      0,
      roundMoney(referralDiscount),
    ),
    referralReward: Math.max(
      0,
      roundMoney(referralReward),
    ),
  };
}

export async function calculateGrowthAdjustments(input: {
  subtotal: number;
  totalBeforeGrowth: number;
  supplierCostTotal: number;
  currency: string;
  promotionCode?: string | null;
  attributionCode?: string | null;
  customerId?: string | null;
  customerEmail?: string | null;
  storeCreditRequested?: number | null;
}): Promise<GrowthAdjustment> {
  await ensureGrowthSchema();

  const subtotal = Math.max(0, roundMoney(input.subtotal));
  const totalBeforeGrowth = Math.max(
    0,
    roundMoney(input.totalBeforeGrowth),
  );
  const supplierCostTotal = Math.max(
    0,
    roundMoney(input.supplierCostTotal),
  );
  const currency = clean(input.currency, 3).toUpperCase() || "TZS";
  const promotionCode = normalizeGrowthCode(input.promotionCode);
  const attributionCode = normalizeGrowthCode(input.attributionCode);
  const customerId = clean(input.customerId, 50) || null;
  const customerEmail = clean(
    input.customerEmail,
    254,
  ).toLowerCase();

  const coupon = await resolveCoupon({
    code: promotionCode,
    subtotal,
    currency,
    customerId,
    customerEmail,
  });

  const attributionCandidate =
    coupon
      ? attributionCode
      : promotionCode || attributionCode;

  const attribution = await resolveAttribution({
    code: attributionCandidate,
    currency,
    subtotal,
    customerId,
    customerEmail,
  });

  if (
    promotionCode &&
    !coupon &&
    !attribution.affiliateId &&
    !attribution.referrerCustomerId
  ) {
    throw new GrowthPricingError(
      "That discount, affiliate or referral code is not valid.",
      404,
    );
  }

  const minimumMarginRate =
    Math.max(
      0,
      Math.min(
        0.5,
        (
          await settingNumber(
            "minimum_growth_profit_margin_percent",
            10,
          )
        ) / 100,
      ),
    );

  const paymentFeeRate =
    Math.max(
      0,
      Math.min(
        0.15,
        (
          await settingNumber(
            "estimated_payment_fee_percent",
            3,
          )
        ) / 100,
      ),
    );

  const affiliateRate =
    Math.max(
      0,
      Math.min(
        0.4,
        attribution.affiliateRate / 100,
      ),
    );

  const safeDenominator = Math.max(
    0.1,
    1 -
      minimumMarginRate -
      paymentFeeRate -
      affiliateRate,
  );

  const maximumSupportedReferralReward =
    Math.max(
      0,
      roundMoney(
        totalBeforeGrowth *
          safeDenominator -
          supplierCostTotal,
      ),
    );

  const effectiveReferralReward =
    roundMoney(
      Math.min(
        attribution.referralReward,
        maximumSupportedReferralReward,
      ),
    );

  const safeMinimumTotal = Math.min(
    totalBeforeGrowth,
    roundMoney(
      (
        supplierCostTotal +
        effectiveReferralReward
      ) / safeDenominator,
    ),
  );

  let availableReduction = Math.max(
    0,
    roundMoney(
      totalBeforeGrowth -
        safeMinimumTotal,
    ),
  );

  const couponDiscount = roundMoney(
    Math.min(
      coupon?.discount || 0,
      availableReduction,
    ),
  );

  availableReduction = Math.max(
    0,
    roundMoney(
      availableReduction -
        couponDiscount,
    ),
  );

  const referralDiscount = roundMoney(
    Math.min(
      attribution.referralDiscount,
      availableReduction,
    ),
  );

  availableReduction = Math.max(
    0,
    roundMoney(
      availableReduction -
        referralDiscount,
    ),
  );

  const discountAmount = roundMoney(
    couponDiscount + referralDiscount,
  );

  const totalAfterDiscount = Math.max(
    0,
    roundMoney(totalBeforeGrowth - discountAmount),
  );

  let storeCreditUsed = 0;

  if (
    customerId &&
    currency === "TZS" &&
    numberValue(input.storeCreditRequested) > 0
  ) {
    const benefits = await getCustomerGrowthBenefits(
      customerId,
    );

    const maxPercent = Math.max(
      0,
      Math.min(
        100,
        await settingNumber(
          "max_store_credit_percent",
          50,
        ),
      ),
    );

    const maximumAllowed =
      totalAfterDiscount * (maxPercent / 100);

    storeCreditUsed = roundMoney(
      Math.min(
        benefits.storeCreditBalance,
        maximumAllowed,
        availableReduction,
        numberValue(input.storeCreditRequested),
      ),
    );
  }

  const total = Math.max(
    safeMinimumTotal,
    roundMoney(
      totalAfterDiscount - storeCreditUsed,
    ),
  );

  return {
    promotionCode: promotionCode || null,
    couponId: coupon?.id || null,
    couponCode: coupon?.code || null,
    couponDiscount,
    affiliateId: attribution.affiliateId,
    affiliateCode: attribution.affiliateCode,
    affiliateRate: attribution.affiliateRate,
    referrerCustomerId:
      attribution.referrerCustomerId,
    referralCode: attribution.referralCode,
    referralDiscount,
    referralReward:
      effectiveReferralReward,
    storeCreditUsed,
    discountAmount,
    total,
  };
}

export async function syncGrowthOrderStatus(input: {
  orderId: string;
  action:
    | "mark_paid"
    | "mark_processing"
    | "mark_shipped"
    | "mark_delivered"
    | "cancel";
}) {
  await ensureGrowthSchema();

  const sql = catalogSql();
  const queries = [];

  if (input.action === "mark_paid") {
    queries.push(
      sql`
        UPDATE growth_coupon_redemptions
        SET
          status = 'redeemed',
          updated_at = NOW()
        WHERE order_id = ${input.orderId}
          AND status = 'reserved'
      `,
      sql`
        UPDATE growth_affiliate_commissions
        SET
          status = 'pending',
          updated_at = NOW()
        WHERE order_id = ${input.orderId}
          AND status = 'pending_payment'
      `,
      sql`
        UPDATE growth_referral_claims
        SET
          status = 'pending',
          updated_at = NOW()
        WHERE order_id = ${input.orderId}
          AND status = 'pending_payment'
      `,
      sql`
        UPDATE growth_store_credit_transactions
        SET
          status = 'posted',
          updated_at = NOW()
        WHERE order_id = ${input.orderId}
          AND kind = 'order_redemption'
          AND status = 'pending'
      `,
    );
  }

  if (input.action === "mark_delivered") {
    queries.push(
      sql`
        UPDATE growth_coupon_redemptions
        SET
          status = 'redeemed',
          updated_at = NOW()
        WHERE order_id = ${input.orderId}
          AND status = 'reserved'
      `,
      sql`
        UPDATE growth_affiliate_commissions
        SET
          status = CASE
            WHEN status = 'paid' THEN status
            ELSE 'approved'
          END,
          approved_at = COALESCE(
            approved_at,
            NOW()
          ),
          updated_at = NOW()
        WHERE order_id = ${input.orderId}
          AND status IN (
            'pending_payment',
            'pending',
            'approved',
            'paid'
          )
      `,
      sql`
        UPDATE growth_store_credit_transactions
        SET
          status = 'posted',
          updated_at = NOW()
        WHERE order_id = ${input.orderId}
          AND kind = 'order_redemption'
          AND status = 'pending'
      `,
      sql`
        INSERT INTO growth_store_credit_transactions (
          id,
          customer_id,
          order_id,
          amount,
          currency,
          kind,
          status,
          description,
          created_at,
          updated_at
        )
        SELECT
          ${randomUUID()},
          claim.referrer_customer_id,
          claim.order_id,
          claim.reward_amount,
          claim.currency,
          'referral_reward',
          'posted',
          'WHOKEAS referral reward for ' ||
            claim.order_number,
          NOW(),
          NOW()
        FROM growth_referral_claims claim
        WHERE claim.order_id = ${input.orderId}
          AND claim.status IN (
            'pending_payment',
            'pending'
          )
          AND claim.reward_amount > 0
        ON CONFLICT (
          order_id,
          kind
        )
        WHERE order_id IS NOT NULL
        DO NOTHING
      `,
      sql`
        UPDATE growth_referral_claims
        SET
          status = 'rewarded',
          rewarded_at = COALESCE(
            rewarded_at,
            NOW()
          ),
          updated_at = NOW()
        WHERE order_id = ${input.orderId}
          AND status IN (
            'pending_payment',
            'pending'
          )
      `,
    );
  }

  if (input.action === "cancel") {
    queries.push(
      sql`
        UPDATE growth_coupon_redemptions
        SET
          status = 'void',
          updated_at = NOW()
        WHERE order_id = ${input.orderId}
          AND status <> 'void'
      `,
      sql`
        UPDATE growth_affiliate_commissions
        SET
          status = 'void',
          updated_at = NOW()
        WHERE order_id = ${input.orderId}
          AND status <> 'paid'
      `,
      sql`
        INSERT INTO growth_store_credit_transactions (
          id,
          customer_id,
          order_id,
          amount,
          currency,
          kind,
          status,
          description,
          created_at,
          updated_at
        )
        SELECT
          ${randomUUID()},
          claim.referrer_customer_id,
          claim.order_id,
          -claim.reward_amount,
          claim.currency,
          'referral_reward_reversal',
          'posted',
          'Referral reward reversed for cancelled order ' ||
            claim.order_number,
          NOW(),
          NOW()
        FROM growth_referral_claims claim
        WHERE claim.order_id = ${input.orderId}
          AND claim.status = 'rewarded'
          AND claim.reward_amount > 0
        ON CONFLICT (
          order_id,
          kind
        )
        WHERE order_id IS NOT NULL
        DO NOTHING
      `,
      sql`
        UPDATE growth_referral_claims
        SET
          status = 'void',
          updated_at = NOW()
        WHERE order_id = ${input.orderId}
          AND status <> 'void'
      `,
      sql`
        UPDATE growth_store_credit_transactions
        SET
          status = 'void',
          updated_at = NOW()
        WHERE order_id = ${input.orderId}
          AND kind = 'order_redemption'
          AND status IN ('pending', 'posted')
      `,
    );
  }

  if (queries.length > 0) {
    await sql.transaction(queries);
  }
}

export async function trackGrowthAttribution(input: {
  code: string;
  visitorId: string;
  landingPath?: string | null;
  referrer?: string | null;
}) {
  await ensureGrowthSchema();

  const code = normalizeGrowthCode(input.code);
  const visitorId = clean(input.visitorId, 80);

  if (!code || visitorId.length < 8) {
    return {
      recognized: false,
    };
  }

  const sql = catalogSql();

  const affiliateRows = await sql`
    SELECT id::text AS id
    FROM growth_affiliates
    WHERE code = ${code}
      AND status = 'active'
    LIMIT 1
  `;

  const referralRows = affiliateRows[0]
    ? []
    : await sql`
        SELECT id::text AS id
        FROM customers
        WHERE referral_code = ${code}
          AND status = 'active'
        LIMIT 1
      `;

  const recognized =
    Boolean(affiliateRows[0]?.id) ||
    Boolean(referralRows[0]?.id);

  if (!recognized) {
    return {
      recognized: false,
    };
  }

  await sql`
    INSERT INTO growth_clicks (
      id,
      attribution_code,
      affiliate_id,
      visitor_id,
      landing_path,
      referrer,
      created_at
    )
    VALUES (
      ${randomUUID()},
      ${code},
      ${affiliateRows[0]?.id || null},
      ${visitorId},
      ${clean(input.landingPath, 1000) || null},
      ${clean(input.referrer, 1000) || null},
      NOW()
    )
    ON CONFLICT (
      attribution_code,
      visitor_id
    )
    DO NOTHING
  `;

  return {
    recognized: true,
    type: affiliateRows[0]?.id
      ? "affiliate"
      : "referral",
  };
}

export async function saveAbandonedCheckout(input: {
  token?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  countryCode?: string | null;
  currency?: string | null;
  estimatedTotal?: number | null;
  promotionCode?: string | null;
  cart?: unknown;
}) {
  await ensureGrowthSchema();

  const sql = catalogSql();
  const requestedToken = clean(input.token, 64);
  const token =
    /^[A-Za-z0-9_-]{20,64}$/.test(requestedToken)
      ? requestedToken
      : randomBytes(24).toString("base64url");

  const cart = Array.isArray(input.cart)
    ? input.cart
        .slice(0, 30)
        .map((item) => {
          if (
            !item ||
            typeof item !== "object"
          ) {
            return null;
          }

          const record =
            item as Record<string, unknown>;

          return {
            productId:
              clean(record.productId, 60) ||
              null,
            variantId:
              clean(record.variantId, 60) ||
              null,
            name:
              clean(record.name, 180) ||
              "Product",
            variantName:
              clean(record.variantName, 160) ||
              null,
            quantity: Math.max(
              1,
              Math.min(
                5,
                Math.floor(
                  numberValue(
                    record.quantity,
                    1,
                  ),
                ),
              ),
            ),
            price: Math.max(
              0,
              roundMoney(
                numberValue(record.price),
              ),
            ),
          };
        })
        .filter(Boolean)
    : [];

  await sql`
    INSERT INTO growth_abandoned_checkouts (
      id,
      recovery_token,
      customer_name,
      customer_email,
      customer_phone,
      country_code,
      currency,
      estimated_total,
      promotion_code,
      cart,
      status,
      first_seen_at,
      last_seen_at
    )
    VALUES (
      ${randomUUID()},
      ${token},
      ${clean(input.customerName, 160) || null},
      ${clean(input.customerEmail, 254).toLowerCase() || null},
      ${clean(input.customerPhone, 40) || null},
      ${clean(input.countryCode, 2).toUpperCase() || null},
      ${clean(input.currency, 3).toUpperCase() || null},
      ${Math.max(0, roundMoney(numberValue(input.estimatedTotal)))},
      ${normalizeGrowthCode(input.promotionCode) || null},
      ${JSON.stringify(cart)}::jsonb,
      'open',
      NOW(),
      NOW()
    )
    ON CONFLICT (recovery_token)
    DO UPDATE SET
      customer_name = EXCLUDED.customer_name,
      customer_email = EXCLUDED.customer_email,
      customer_phone = EXCLUDED.customer_phone,
      country_code = EXCLUDED.country_code,
      currency = EXCLUDED.currency,
      estimated_total = EXCLUDED.estimated_total,
      promotion_code = EXCLUDED.promotion_code,
      cart = EXCLUDED.cart,
      status = CASE
        WHEN growth_abandoned_checkouts.status = 'recovered'
          THEN growth_abandoned_checkouts.status
        ELSE 'open'
      END,
      last_seen_at = NOW()
  `;

  return token;
}

export async function getGrowthDashboard() {
  await ensureGrowthSchema();

  const sql = catalogSql();

  const [
    profitRows,
    recentProfitRows,
    couponRows,
    affiliateRows,
    commissionRows,
    referralRows,
    abandonedRows,
  ] = await Promise.all([
    sql`
      SELECT
        COALESCE(SUM(order_record.total), 0)::text AS revenue,
        COALESCE(
          SUM(order_record.supplier_cost_total),
          0
        )::text AS "supplierCost",
        COALESCE(SUM(payment.fee), 0)::text AS "paymentFees",
        COALESCE(
          SUM(commission.commission_amount),
          0
        )::text AS "affiliateCommissions",
        COALESCE(
          (
            SELECT SUM(amount)
            FROM growth_store_credit_transactions
            WHERE kind IN (
                'referral_reward',
                'referral_reward_reversal'
              )
              AND status = 'posted'
              AND currency = 'TZS'
          ),
          0
        )::text AS "referralRewards",
        COALESCE(
          SUM(order_record.discount_amount),
          0
        )::text AS discounts,
        COALESCE(
          SUM(order_record.store_credit_used),
          0
        )::text AS "storeCreditUsed",
        COUNT(*)::int AS orders
      FROM orders order_record

      LEFT JOIN LATERAL (
        SELECT fee
        FROM payments
        WHERE order_id = order_record.id
        ORDER BY created_at DESC
        LIMIT 1
      ) payment ON TRUE

      LEFT JOIN growth_affiliate_commissions commission
        ON commission.order_id = order_record.id
       AND commission.status <> 'void'

      WHERE order_record.currency = 'TZS'
        AND order_record.status::text IN (
          'paid',
          'processing',
          'shipped',
          'delivered'
        )
    `,
    sql`
      SELECT
        order_record.order_number AS "orderNumber",
        order_record.customer_name AS "customerName",
        order_record.status::text AS status,
        order_record.total::text AS revenue,
        order_record.supplier_cost_total::text AS "supplierCost",
        COALESCE(payment.fee, 0)::text AS "paymentFee",
        COALESCE(
          commission.commission_amount,
          0
        )::text AS commission,
        (
          order_record.total
          - order_record.supplier_cost_total
          - COALESCE(payment.fee, 0)
          - COALESCE(
              commission.commission_amount,
              0
            )
        )::text AS profit,
        order_record.created_at AS "createdAt"
      FROM orders order_record

      LEFT JOIN LATERAL (
        SELECT fee
        FROM payments
        WHERE order_id = order_record.id
        ORDER BY created_at DESC
        LIMIT 1
      ) payment ON TRUE

      LEFT JOIN growth_affiliate_commissions commission
        ON commission.order_id = order_record.id
       AND commission.status <> 'void'

      WHERE order_record.currency = 'TZS'
        AND order_record.status::text IN (
          'paid',
          'processing',
          'shipped',
          'delivered'
        )
      ORDER BY order_record.created_at DESC
      LIMIT 20
    `,
    sql`
      SELECT
        coupon.id::text AS id,
        coupon.code,
        coupon.name,
        coupon.discount_type AS "discountType",
        coupon.discount_value::text AS "discountValue",
        coupon.maximum_discount::text AS "maximumDiscount",
        coupon.minimum_order::text AS "minimumOrder",
        coupon.currency,
        coupon.usage_limit AS "usageLimit",
        coupon.per_customer_limit AS "perCustomerLimit",
        coupon.is_active AS "active",
        coupon.starts_at AS "startsAt",
        coupon.expires_at AS "expiresAt",
        COUNT(redemption.id) FILTER (
          WHERE redemption.status = 'redeemed'
        )::int AS redemptions,
        COALESCE(
          SUM(redemption.amount) FILTER (
            WHERE redemption.status = 'redeemed'
          ),
          0
        )::text AS "discountGranted"
      FROM growth_coupons coupon
      LEFT JOIN growth_coupon_redemptions redemption
        ON redemption.coupon_id = coupon.id
      GROUP BY coupon.id
      ORDER BY coupon.created_at DESC
      LIMIT 100
    `,
    sql`
      SELECT
        affiliate.id::text AS id,
        affiliate.name,
        affiliate.code,
        affiliate.email,
        affiliate.phone,
        affiliate.commission_rate::text AS "commissionRate",
        affiliate.status,
        COALESCE(clicks.count, 0)::int AS clicks,
        COALESCE(commissions.orders, 0)::int AS orders,
        COALESCE(
          commissions.total,
          0
        )::text AS "commissionTotal",
        COALESCE(
          commissions.paid,
          0
        )::text AS "commissionPaid"
      FROM growth_affiliates affiliate

      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS count
        FROM growth_clicks
        WHERE affiliate_id = affiliate.id
      ) clicks ON TRUE

      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) FILTER (
            WHERE status <> 'void'
          )::int AS orders,
          COALESCE(
            SUM(commission_amount) FILTER (
              WHERE status IN (
                'pending',
                'approved',
                'paid'
              )
            ),
            0
          ) AS total,
          COALESCE(
            SUM(commission_amount) FILTER (
              WHERE status = 'paid'
            ),
            0
          ) AS paid
        FROM growth_affiliate_commissions
        WHERE affiliate_id = affiliate.id
      ) commissions ON TRUE

      ORDER BY affiliate.created_at DESC
      LIMIT 100
    `,
    sql`
      SELECT
        commission.id::text AS id,
        commission.order_number AS "orderNumber",
        affiliate.name AS "affiliateName",
        affiliate.code AS "affiliateCode",
        commission.revenue_amount::text AS revenue,
        commission.commission_rate::text AS rate,
        commission.commission_amount::text AS amount,
        commission.currency,
        commission.status,
        commission.created_at AS "createdAt"
      FROM growth_affiliate_commissions commission
      JOIN growth_affiliates affiliate
        ON affiliate.id = commission.affiliate_id
      ORDER BY commission.created_at DESC
      LIMIT 100
    `,
    sql`
      SELECT
        COUNT(*) FILTER (
          WHERE status = 'rewarded'
        )::int AS rewarded,
        COUNT(*) FILTER (
          WHERE status IN (
            'pending_payment',
            'pending'
          )
        )::int AS pending,
        COALESCE(
          SUM(reward_amount) FILTER (
            WHERE status = 'rewarded'
              AND currency = 'TZS'
          ),
          0
        )::text AS "rewardedTzs",
        COALESCE(
          (
            SELECT SUM(amount)
            FROM growth_store_credit_transactions
            WHERE status = 'posted'
              AND currency = 'TZS'
          ),
          0
        )::text AS "postedCreditTzs"
      FROM growth_referral_claims
    `,
    sql`
      SELECT
        checkout.id::text AS id,
        checkout.recovery_token AS "recoveryToken",
        checkout.customer_name AS "customerName",
        checkout.customer_email AS "customerEmail",
        checkout.customer_phone AS "customerPhone",
        checkout.country_code AS "countryCode",
        checkout.currency,
        checkout.estimated_total::text AS "estimatedTotal",
        checkout.promotion_code AS "promotionCode",
        checkout.cart,
        checkout.status,
        checkout.first_seen_at AS "firstSeenAt",
        checkout.last_seen_at AS "lastSeenAt",
        checkout.contacted_at AS "contactedAt"
      FROM growth_abandoned_checkouts checkout
      WHERE checkout.status IN (
        'open',
        'contacted'
      )
      ORDER BY checkout.last_seen_at DESC
      LIMIT 100
    `,
  ]);

  const profit = profitRows[0] || {};
  const revenue = numberValue(profit.revenue);
  const supplierCost = numberValue(profit.supplierCost);
  const paymentFees = numberValue(profit.paymentFees);
  const affiliateCommissions = numberValue(
    profit.affiliateCommissions,
  );
  const referralRewards = numberValue(
    profit.referralRewards,
  );

  return {
    siteUrl:
      process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
      "https://www.whokeas.store",
    profit: {
      revenue,
      supplierCost,
      paymentFees,
      affiliateCommissions,
      referralRewards,
      discounts: numberValue(profit.discounts),
      storeCreditUsed: numberValue(
        profit.storeCreditUsed,
      ),
      orders: numberValue(profit.orders),
      netProfit: roundMoney(
        revenue -
          supplierCost -
          paymentFees -
          affiliateCommissions,
      ),
    },
    recentProfits: recentProfitRows,
    coupons: couponRows,
    affiliates: affiliateRows,
    commissions: commissionRows,
    referrals: referralRows[0] || {
      rewarded: 0,
      pending: 0,
      rewardedTzs: "0",
      postedCreditTzs: "0",
    },
    abandoned: abandonedRows,
  };
}

export async function createGrowthCoupon(input: {
  code?: string;
  name?: string;
  discountType?: string;
  discountValue?: number;
  maximumDiscount?: number | null;
  minimumOrder?: number;
  currency?: string;
  usageLimit?: number | null;
  perCustomerLimit?: number;
  startsAt?: string | null;
  expiresAt?: string | null;
}) {
  await ensureGrowthSchema();

  const code = normalizeGrowthCode(input.code);
  const name = clean(input.name, 160);
  const discountType =
    input.discountType === "fixed"
      ? "fixed"
      : "percent";
  const discountValue = numberValue(
    input.discountValue,
  );
  const currency =
    clean(input.currency, 3).toUpperCase() ||
    "TZS";

  if (!code || code.length < 3) {
    throw new Error(
      "Coupon code requires at least three letters or numbers.",
    );
  }

  if (!name) {
    throw new Error("Enter a coupon name.");
  }

  if (discountValue <= 0) {
    throw new Error(
      "Coupon discount must be greater than zero.",
    );
  }

  if (
    discountType === "percent" &&
    discountValue > 80
  ) {
    throw new Error(
      "Percentage discounts cannot exceed 80%.",
    );
  }

  const sql = catalogSql();

  await sql`
    INSERT INTO growth_coupons (
      id,
      code,
      name,
      discount_type,
      discount_value,
      maximum_discount,
      minimum_order,
      currency,
      usage_limit,
      per_customer_limit,
      is_active,
      starts_at,
      expires_at,
      created_at,
      updated_at
    )
    VALUES (
      ${randomUUID()},
      ${code},
      ${name},
      ${discountType},
      ${discountValue},
      ${
        numberValue(input.maximumDiscount) > 0
          ? numberValue(input.maximumDiscount)
          : null
      },
      ${Math.max(
        0,
        numberValue(input.minimumOrder),
      )},
      ${currency},
      ${
        numberValue(input.usageLimit) > 0
          ? Math.floor(numberValue(input.usageLimit))
          : null
      },
      ${Math.max(
        1,
        Math.floor(
          numberValue(input.perCustomerLimit, 1),
        ),
      )},
      true,
      ${clean(input.startsAt, 40) || null},
      ${clean(input.expiresAt, 40) || null},
      NOW(),
      NOW()
    )
  `;
}

export async function toggleGrowthCoupon(
  couponId: string,
) {
  await ensureGrowthSchema();

  const sql = catalogSql();

  await sql`
    UPDATE growth_coupons
    SET
      is_active = NOT is_active,
      updated_at = NOW()
    WHERE id = ${couponId}
  `;
}

export async function createGrowthAffiliate(input: {
  name?: string;
  code?: string;
  email?: string;
  phone?: string;
  commissionRate?: number;
  notes?: string;
}) {
  await ensureGrowthSchema();

  const name = clean(input.name, 160);
  const code =
    normalizeGrowthCode(input.code) ||
    generateReadableCode("PARTNER");
  const commissionRate = Math.max(
    0,
    Math.min(
      40,
      numberValue(input.commissionRate, 5),
    ),
  );

  if (!name) {
    throw new Error("Enter the affiliate name.");
  }

  const sql = catalogSql();

  await sql`
    INSERT INTO growth_affiliates (
      id,
      name,
      code,
      email,
      phone,
      commission_rate,
      status,
      notes,
      created_at,
      updated_at
    )
    VALUES (
      ${randomUUID()},
      ${name},
      ${code},
      ${clean(input.email, 254).toLowerCase() || null},
      ${clean(input.phone, 40) || null},
      ${commissionRate},
      'active',
      ${clean(input.notes, 1000) || null},
      NOW(),
      NOW()
    )
  `;

  return code;
}

export async function toggleGrowthAffiliate(
  affiliateId: string,
) {
  await ensureGrowthSchema();

  const sql = catalogSql();

  await sql`
    UPDATE growth_affiliates
    SET
      status = CASE
        WHEN status = 'active' THEN 'paused'
        ELSE 'active'
      END,
      updated_at = NOW()
    WHERE id = ${affiliateId}
      AND status <> 'blocked'
  `;
}

export async function markGrowthCommissionPaid(
  commissionId: string,
) {
  await ensureGrowthSchema();

  const sql = catalogSql();

  await sql`
    UPDATE growth_affiliate_commissions
    SET
      status = 'paid',
      approved_at = COALESCE(
        approved_at,
        NOW()
      ),
      paid_at = NOW(),
      updated_at = NOW()
    WHERE id = ${commissionId}
      AND status = 'approved'
  `;
}

export async function updateAbandonedCheckoutStatus(
  checkoutId: string,
  status: "contacted" | "closed",
) {
  await ensureGrowthSchema();

  const sql = catalogSql();

  await sql`
    UPDATE growth_abandoned_checkouts
    SET
      status = ${status},
      contacted_at = CASE
        WHEN ${status} = 'contacted'
          THEN COALESCE(contacted_at, NOW())
        ELSE contacted_at
      END,
      closed_at = CASE
        WHEN ${status} = 'closed'
          THEN NOW()
        ELSE closed_at
      END,
      last_seen_at = NOW()
    WHERE id = ${checkoutId}
      AND status IN ('open', 'contacted')
  `;
}
