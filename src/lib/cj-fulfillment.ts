import { catalogSql, ensureCatalogSchema } from "@/lib/catalog-schema";
import { CJRequestError, cjNumber, cjRequest } from "@/lib/cj";

const STAGE_ORDER = [
  "queued",
  "creating",
  "created",
  "cart_added",
  "cart_confirmed",
  "awaiting_cj_payment",
] as const;

type Stage = (typeof STAGE_ORDER)[number];

type ShippingAddress = {
  recipientName?: string;
  phone?: string;
  countryCode?: string;
  countryName?: string;
  region?: string | null;
  city?: string;
  postalCode?: string | null;
  addressLine1?: string;
  addressLine2?: string | null;
};

type LocalOrder = {
  id: string;
  orderNumber: string;
  status: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  customerNotes: string | null;
  createdAt: string;
  shippingAddress: ShippingAddress;
};

type LocalOrderItem = {
  id: string;
  productId: string | null;
  variantId: string | null;
  productName: string;
  variantName: string | null;
  sku: string | null;
  quantity: number;
  supplierPlatform: string | null;
  supplierExternalProductId: string | null;
  cjVariantId: string | null;
  productImage: string | null;
  originCountryCode: string | null;
  storedFreightMethod: string | null;
};

type CJFreightOption = {
  logisticName?: string;
  logisticsName?: string;
  enName?: string;
  option?: {
    enName?: string;
  };
  channel?: {
    enName?: string;
  };
  logisticAging?: string;
  arrivalTime?: string;
  logisticPrice?: number | string;
  totalPostageFee?: number | string;
  postageAmount?: number | string;
  shippingCost?: number | string;
  freightAmount?: number | string;
  logisticsCost?: number | string;
  selected?: boolean;
  error?: string;
  errorEn?: string;
};

type CJFreightResponse =
  | CJFreightOption[]
  | {
      freightTrialList?: CJFreightOption[];
      logisticsInfoList?: CJFreightOption[];
      availableLogisticList?: CJFreightOption[];
      errorEnList?: unknown[];
      errorSuggestionList?: unknown[];
      [key: string]: unknown;
    };

type CJStockRow = {
  vid?: string;
  areaId?: string;
  areaEn?: string;
  countryCode?: string;
  storageNum?: number | string;
  totalInventoryNum?: number | string;
};

type CJCreateOrderData = {
  orderNumber?: string;
  orderId?: string;
  shipmentOrderId?: string;
  cjPayUrl?: string;
  orderStatus?: string;
  logisticsMiss?: boolean;
  actualPayment?: number | string;
  orderAmount?: number | string;
  postageAmount?: number | string;
  productAmount?: number | string;
  interceptOrderReasons?: Array<{
    code?: number | string;
    message?: string;
  }>;
  [key: string]: unknown;
};

type CJAddCartData = {
  successCount?: number;
  addSuccessOrders?: string[];
  interceptOrders?: unknown[];
  [key: string]: unknown;
};

type CJConfirmCartData = {
  successCount?: number;
  submitSuccess?: boolean;
  shipmentsId?: string;
  result?: number;
  interceptOrders?: unknown[];
  [key: string]: unknown;
};

type CJParentOrderData = {
  orderMoney?: number | string;
  payExpireTime?: string;
  payId?: string;
  result?: number;
  submitSuccess?: boolean;
  unMatchOrderCodes?: string[];
  unMatchProductCodes?: string[];
  successOrders?: string[];
  paymentInformation?: {
    actualPayment?: number | string;
    payableAmount?: number | string;
    freight?: number | string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

type CJOrderDetail = {
  orderId?: string;
  orderNum?: string;
  cjOrderId?: string | null;
  orderStatus?: string;
  subStatus?: string | null;
  logisticName?: string | null;
  trackNumber?: string | null;
  trackingProvider?: string | null;
  trackingUrl?: string | null;
  orderAmount?: number | string | null;
  productAmount?: number | string | null;
  postageAmount?: number | string | null;
  paymentDate?: string | null;
  [key: string]: unknown;
};

type CJTrackingInfo = {
  trackingNumber?: string;
  logisticName?: string;
  trackingStatus?: string;
  lastMileCarrier?: string;
  lastTrackNumber?: string;
  [key: string]: unknown;
};

export type CJFulfillmentRecord = {
  orderId: string;
  localOrderNumber: string;
  status: string;
  stage: string;
  isSandbox: boolean;
  cjOrderId: string | null;
  shipmentOrderId: string | null;
  payId: string | null;
  cjOrderStatus: string | null;
  logisticsName: string | null;
  originCountryCode: string | null;
  logisticsCostUsd: number | null;
  estimatedDelivery: string | null;
  payableAmountUsd: number | null;
  cjPayUrl: string | null;
  trackingNumber: string | null;
  trackingProvider: string | null;
  trackingUrl: string | null;
  attemptCount: number;
  lastError: string | null;
  lastSyncedAt: string | null;
  updatedAt: string;
};

let fulfillmentSchemaPromise: Promise<void> | null = null;

function clean(value: unknown, maximum = 200) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function envBoolean(name: string, fallback: boolean) {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return fallback;
  if (["1", "true", "yes", "on"].includes(value)) return true;
  if (["0", "false", "no", "off"].includes(value)) return false;
  return fallback;
}

function platformHeaders(): Record<string, string> {
  const platformToken = process.env.CJ_PLATFORM_TOKEN?.trim();
  return platformToken ? { platformToken } : {};
}

function stageAtLeast(current: string, target: Stage) {
  const currentIndex = STAGE_ORDER.indexOf(current as Stage);
  const targetIndex = STAGE_ORDER.indexOf(target);
  return currentIndex >= targetIndex;
}

function phoneForCJ(value: string) {
  const normalized = value.replace(/[^+0-9]/g, "");
  return normalized.slice(0, 20);
}

function errorText(error: unknown) {
  if (error instanceof CJRequestError) {
    const requestId = error.requestId ? ` Request ID: ${error.requestId}.` : "";
    return `${error.message}${requestId}`.slice(0, 3000);
  }
  return (error instanceof Error ? error.message : "CJ fulfillment failed.").slice(
    0,
    3000,
  );
}

function fulfillmentStatusFromCJ(status: string) {
  const normalized = status.trim().toUpperCase();

  if (["DELIVERED", "COMPLETED"].includes(normalized)) return "delivered";
  if (["SHIPPED", "IN_TRANSIT"].includes(normalized)) return "shipped";
  if (["CANCELLED", "CANCELED", "CLOSED"].includes(normalized)) {
    return "cancelled";
  }
  if (["PENDING", "PROCESSING", "UNSHIPPED"].includes(normalized)) {
    return "cj_processing";
  }
  if (["UNPAID", "IN_CART", "CREATED"].includes(normalized)) {
    return "awaiting_cj_payment";
  }
  return normalized ? "created" : "awaiting_cj_payment";
}

function logisticsAmount(option: CJFreightOption) {
  const candidates = [
    option.shippingCost,
    option.freightAmount,
    option.logisticsCost,
    option.totalPostageFee,
    option.postageAmount,
    option.logisticPrice,
  ];

  for (const candidate of candidates) {
    const parsed = Number(candidate);

    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }

  return Number.NaN;
}

function logisticsName(option: CJFreightOption) {
  return clean(
    option.logisticsName ||
      option.logisticName ||
      option.enName ||
      option.option?.enName ||
      option.channel?.enName,
    200,
  );
}

function deliveryWindow(option: CJFreightOption) {
  return clean(option.arrivalTime || option.logisticAging, 100) || null;
}

function extractFreightOptions(
  response: CJFreightResponse | null | undefined,
) {
  if (!response) return [];
  if (Array.isArray(response)) return response;

  return (
    response.freightTrialList ||
    response.logisticsInfoList ||
    response.availableLogisticList ||
    []
  );
}

function readableFreightDiagnostic(value: unknown) {
  if (typeof value === "string") {
    return clean(value, 500);
  }

  if (!value || typeof value !== "object") {
    return "";
  }

  const record = value as Record<string, unknown>;

  return clean(
    record.msgEn ||
      record.message ||
      record.errorEn ||
      record.error ||
      JSON.stringify(record),
    500,
  );
}

function freightDiagnostics(
  response: CJFreightResponse | null | undefined,
) {
  if (!response || Array.isArray(response)) return [];

  return [
    ...(response.errorEnList || []),
    ...(response.errorSuggestionList || []),
  ]
    .map(readableFreightDiagnostic)
    .filter(Boolean);
}

function preferredLogisticsNames(items: LocalOrderItem[] = []) {
  const stored = items
    .map((item) => clean(item.storedFreightMethod, 200).toLowerCase())
    .filter(Boolean);
  const configured = String(process.env.CJ_PREFERRED_LOGISTICS || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  return [...new Set([...stored, ...configured])];
}

function chooseFreightOption(
  options: CJFreightOption[],
  preferences: string[] = [],
  diagnostics: string[] = [],
) {
  const valid = options.filter((option) => {
    const name = logisticsName(option);
    const amount = logisticsAmount(option);

    return (
      name &&
      Number.isFinite(amount) &&
      amount >= 0 &&
      !clean(option.error || option.errorEn, 300)
    );
  });

  if (valid.length === 0) {
    const optionErrors = options
      .map((option) => clean(option.errorEn || option.error, 500))
      .filter(Boolean);

    const detail = [...new Set([...diagnostics, ...optionErrors])]
      .slice(0, 5)
      .join(" ");

    throw new Error(
      detail
        ? `CJ returned no usable logistics method. ${detail}`
        : "CJ returned no usable logistics method for this product and destination.",
    );
  }

  for (const preference of preferences) {
    const match = valid.find((option) =>
      logisticsName(option).toLowerCase().includes(preference),
    );
    if (match) return match;
  }

  const selection = String(
    process.env.CJ_LOGISTICS_SELECTION || "cheapest",
  ).toLowerCase();

  if (selection === "fastest") {
    return [...valid].sort((left, right) => {
      const leftDays = Number(deliveryWindow(left)?.match(/\d+/)?.[0] || 9999);
      const rightDays = Number(deliveryWindow(right)?.match(/\d+/)?.[0] || 9999);
      if (leftDays !== rightDays) return leftDays - rightDays;
      return logisticsAmount(left) - logisticsAmount(right);
    })[0];
  }

  return [...valid].sort(
    (left, right) => logisticsAmount(left) - logisticsAmount(right),
  )[0];
}

export async function ensureCJFulfillmentSchema() {
  if (!fulfillmentSchemaPromise) {
    fulfillmentSchemaPromise = (async () => {
      await ensureCatalogSchema();
      const sql = catalogSql();

      await sql`
        CREATE TABLE IF NOT EXISTS cj_order_fulfillments (
          order_id uuid PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
          local_order_number varchar(40) NOT NULL UNIQUE,
          status varchar(50) NOT NULL DEFAULT 'queued',
          stage varchar(50) NOT NULL DEFAULT 'queued',
          is_sandbox boolean NOT NULL DEFAULT true,
          cj_order_id varchar(200),
          shipment_order_id varchar(200),
          pay_id varchar(200),
          cj_order_status varchar(100),
          logistics_name varchar(200),
          origin_country_code varchar(2),
          logistics_cost_usd numeric(14,2),
          estimated_delivery varchar(100),
          payable_amount_usd numeric(14,2),
          cj_pay_url text,
          tracking_number varchar(200),
          tracking_provider varchar(200),
          tracking_url text,
          attempt_count integer NOT NULL DEFAULT 0,
          locked_at timestamptz,
          last_error text,
          create_response jsonb,
          cart_response jsonb,
          confirm_response jsonb,
          parent_response jsonb,
          detail_response jsonb,
          last_synced_at timestamptz,
          created_at timestamptz NOT NULL DEFAULT NOW(),
          updated_at timestamptz NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        ALTER TABLE cj_order_fulfillments
        ADD COLUMN IF NOT EXISTS origin_country_code varchar(2)
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS cj_order_fulfillments_status_idx
        ON cj_order_fulfillments (status, updated_at)
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS cj_order_fulfillments_cj_order_idx
        ON cj_order_fulfillments (cj_order_id)
      `;
    })().catch((error) => {
      fulfillmentSchemaPromise = null;
      throw error;
    });
  }

  return fulfillmentSchemaPromise;
}

async function getFulfillmentByOrderId(orderId: string) {
  const sql = catalogSql();
  const rows = await sql`
    SELECT
      order_id::text AS "orderId",
      local_order_number AS "localOrderNumber",
      status,
      stage,
      is_sandbox AS "isSandbox",
      cj_order_id AS "cjOrderId",
      shipment_order_id AS "shipmentOrderId",
      pay_id AS "payId",
      cj_order_status AS "cjOrderStatus",
      logistics_name AS "logisticsName",
      origin_country_code AS "originCountryCode",
      logistics_cost_usd::text AS "logisticsCostUsd",
      estimated_delivery AS "estimatedDelivery",
      payable_amount_usd::text AS "payableAmountUsd",
      cj_pay_url AS "cjPayUrl",
      tracking_number AS "trackingNumber",
      tracking_provider AS "trackingProvider",
      tracking_url AS "trackingUrl",
      attempt_count AS "attemptCount",
      last_error AS "lastError",
      last_synced_at::text AS "lastSyncedAt",
      updated_at::text AS "updatedAt"
    FROM cj_order_fulfillments
    WHERE order_id = ${orderId}
    LIMIT 1
  `;

  const row = rows[0];
  if (!row) return null;

  return {
    ...row,
    logisticsCostUsd:
      row.logisticsCostUsd === null ? null : Number(row.logisticsCostUsd),
    payableAmountUsd:
      row.payableAmountUsd === null ? null : Number(row.payableAmountUsd),
    attemptCount: Number(row.attemptCount || 0),
    isSandbox: Boolean(row.isSandbox),
  } as CJFulfillmentRecord;
}

export async function getCJFulfillment(orderNumber: string) {
  await ensureCJFulfillmentSchema();
  const sql = catalogSql();
  const rows = await sql`
    SELECT order_id::text AS "orderId"
    FROM cj_order_fulfillments
    WHERE local_order_number = ${orderNumber.trim().toUpperCase()}
    LIMIT 1
  `;
  const orderId = rows[0]?.orderId ? String(rows[0].orderId) : "";
  return orderId ? getFulfillmentByOrderId(orderId) : null;
}

async function loadLocalOrder(orderNumber: string) {
  const sql = catalogSql();
  const normalized = orderNumber.trim().toUpperCase();

  const orderRows = await sql`
    SELECT
      id::text AS id,
      order_number AS "orderNumber",
      status::text AS status,
      customer_name AS "customerName",
      customer_phone AS "customerPhone",
      customer_email AS "customerEmail",
      customer_notes AS "customerNotes",
      created_at::text AS "createdAt",
      shipping_address AS "shippingAddress"
    FROM orders
    WHERE order_number = ${normalized}
    LIMIT 1
  `;

  const order = orderRows[0] as LocalOrder | undefined;
  if (!order?.id) throw new Error("Order not found.");

  const marketCountryCode = clean(
    order.shippingAddress?.countryCode || "TZ",
    2,
  ).toUpperCase();

  const itemRows = await sql`
    SELECT
      item.id::text AS id,
      item.product_id::text AS "productId",
      item.variant_id::text AS "variantId",
      item.product_name AS "productName",
      item.variant_name AS "variantName",
      item.sku,
      item.quantity,
      product.supplier_platform AS "supplierPlatform",
      product.supplier_external_product_id AS "supplierExternalProductId",
      COALESCE(
        selected_variant.external_variant_id,
        selected_variant.supplier_variant_id,
        single_variant.external_variant_id,
        single_variant.supplier_variant_id
      ) AS "cjVariantId",
      image.image_url AS "productImage",
      COALESCE(
        product.supplier_raw_data #>> '{cj,originCountryCode}',
        ${process.env.CJ_DEFAULT_ORIGIN_COUNTRY_CODE || "CN"}
      ) AS "originCountryCode",
      market.freight_method AS "storedFreightMethod"
    FROM order_items item
    LEFT JOIN products product
      ON product.id = item.product_id
    LEFT JOIN product_variants selected_variant
      ON selected_variant.id = item.variant_id
    LEFT JOIN LATERAL (
      SELECT
        MIN(variant.external_variant_id) AS external_variant_id,
        MIN(variant.supplier_variant_id) AS supplier_variant_id
      FROM product_variants variant
      WHERE variant.product_id = item.product_id
        AND variant.is_active = TRUE
      HAVING COUNT(*) = 1
    ) single_variant ON item.variant_id IS NULL
    LEFT JOIN LATERAL (
      SELECT product_image.image_url
      FROM product_images product_image
      WHERE product_image.product_id = item.product_id
      ORDER BY product_image.sort_order ASC, product_image.created_at ASC
      LIMIT 1
    ) image ON TRUE
    LEFT JOIN product_market_prices market
      ON market.product_id = item.product_id
     AND market.country_code = ${marketCountryCode}
    WHERE item.order_id = ${order.id}
    ORDER BY item.id
  `;

  const items = itemRows.map((row: Record<string, unknown>) => ({
    ...row,
    quantity: Number(row.quantity || 0),
  })) as LocalOrderItem[];

  if (items.length === 0) throw new Error("The order has no items.");
  return { order, items };
}

function validateCJItems(items: LocalOrderItem[]) {
  for (const item of items) {
    if (String(item.supplierPlatform || "").toLowerCase() !== "cj") {
      throw new Error(
        `${item.productName} is not a CJ product. Mixed-supplier orders are not supported by this bridge yet.`,
      );
    }
    if (!clean(item.cjVariantId, 220)) {
      throw new Error(
        `${item.productName}${item.variantName ? ` (${item.variantName})` : ""} is missing its CJ variant ID. Re-import or repair this product before fulfillment.`,
      );
    }
    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      throw new Error(`${item.productName} has an invalid quantity.`);
    }
  }
}

function originCountry(items: LocalOrderItem[]) {
  const origins = [
    ...new Set(
      items
        .map((item) => clean(item.originCountryCode, 2).toUpperCase())
        .filter((item) => /^[A-Z]{2}$/.test(item)),
    ),
  ];

  if (origins.length === 1) return origins[0];
  return clean(process.env.CJ_DEFAULT_ORIGIN_COUNTRY_CODE || "CN", 2).toUpperCase();
}

function stockQuantity(row: CJStockRow) {
  const storage = Number(row.storageNum);
  const total = Number(row.totalInventoryNum);

  return Math.max(
    Number.isFinite(storage) ? storage : 0,
    Number.isFinite(total) ? total : 0,
  );
}

async function discoverCommonWarehouseOrigins(
  items: LocalOrderItem[],
  preferredOrigin: string,
) {
  const diagnostics: string[] = [];
  const originSets: Set<string>[] = [];
  const uniqueVids = [
    ...new Set(
      items
        .map((item) => clean(item.cjVariantId, 200))
        .filter(Boolean),
    ),
  ];

  for (const vid of uniqueVids) {
    try {
      const stockRows = await cjRequest<CJStockRow[]>(
        `/v1/product/stock/queryByVid?vid=${encodeURIComponent(vid)}`,
      );

      const origins = new Set(
        stockRows
          .filter((row) => stockQuantity(row) > 0)
          .map((row) => clean(row.countryCode, 2).toUpperCase())
          .filter((countryCode) => /^[A-Z]{2}$/.test(countryCode)),
      );

      if (origins.size === 0) {
        diagnostics.push(
          `CJ reports no available warehouse stock for variant ${vid}.`,
        );
      }

      originSets.push(origins);
    }
    catch (error) {
      diagnostics.push(errorText(error));
    }
  }

  let commonOrigins: string[] = [];

  if (originSets.length > 0) {
    commonOrigins = [...originSets[0]].filter((origin) =>
      originSets.every((set) => set.has(origin)),
    );
  }

  if (commonOrigins.length === 0 && originSets.some((set) => set.size > 0)) {
    throw new Error(
      "The CJ items in this order are not stocked in one common warehouse. Place products from different warehouses in separate orders.",
    );
  }

  const fallback = /^[A-Z]{2}$/.test(preferredOrigin)
    ? preferredOrigin
    : "CN";

  if (commonOrigins.length === 0) {
    commonOrigins = [fallback];
  }

  return {
    origins: [...new Set(commonOrigins)].sort((left, right) => {
      if (left === fallback) return -1;
      if (right === fallback) return 1;
      if (left === "CN") return -1;
      if (right === "CN") return 1;
      return left.localeCompare(right);
    }),
    diagnostics,
  };
}

async function selectLogistics(input: {
  order: LocalOrder;
  items: LocalOrderItem[];
  fromCountryCode: string;
}) {
  const address = input.order.shippingAddress || {};
  const postalCode = clean(
    address.postalCode || process.env.CJ_DEFAULT_POSTAL_CODE || "00000",
    20,
  );
  const province = clean(address.region || address.city || "Not specified", 50);
  const city = clean(address.city || province, 50);
  const countryCode = clean(address.countryCode || "TZ", 2).toUpperCase();
  const countryName = clean(address.countryName || countryCode, 50);
  const addressLine1 = clean(address.addressLine1, 200);
  const houseNumber =
    clean(addressLine1.match(/^\s*([A-Za-z0-9-]+)/)?.[1], 20) || "";

  if (countryCode === "TZ" && !/^\d{5}$/.test(postalCode)) {
    throw new Error(
      "Tanzania delivery requires the exact five-digit TCRA postcode. Create a new test order with the correct ward postcode.",
    );
  }

  if (addressLine1.length < 5) {
    throw new Error(
      "Enter a complete delivery address with house/building and street, ward or delivery point.",
    );
  }

  const products = input.items.map((item) => ({
    vid: clean(item.cjVariantId, 200),
    quantity: item.quantity,
  }));

  const warehouseResult = await discoverCommonWarehouseOrigins(
    input.items,
    input.fromCountryCode,
  );

  const diagnostics = [...warehouseResult.diagnostics];
  const candidates: Array<{
    option: CJFreightOption;
    originCountryCode: string;
  }> = [];

  for (const originCountryCode of warehouseResult.origins) {
    let options: CJFreightOption[] = [];

    try {
      const partnerResponse = await cjRequest<CJFreightResponse>(
        "/v1/logistic/partnerFreightCalculate",
        {
          method: "POST",
          headers: platformHeaders(),
          body: JSON.stringify({
            orderNumber: input.order.orderNumber,
            shippingZip: postalCode,
            shippingCountryCode: countryCode,
            shippingCountry: countryName,
            shippingProvince: province,
            shippingCity: city,
            shippingAddress: addressLine1,
            shippingCustomerName: clean(
              address.recipientName || input.order.customerName,
              50,
            ),
            shippingPhone: phoneForCJ(
              clean(address.phone || input.order.customerPhone, 40),
            ),
            houseNumber,
            remark: clean(input.order.customerNotes, 500),
            fromCountryCode: originCountryCode,
            email: clean(input.order.customerEmail, 50),
            iossType: 1,
            products,
          }),
        },
      );

      options = extractFreightOptions(partnerResponse);
      diagnostics.push(...freightDiagnostics(partnerResponse));
    }
    catch (error) {
      diagnostics.push(
        `${originCountryCode}: ${errorText(error)}`,
      );
    }

    if (options.length === 0) {
      try {
        const simpleResponse = await cjRequest<CJFreightResponse>(
          "/v1/logistic/freightCalculate",
          {
            method: "POST",
            headers: platformHeaders(),
            body: JSON.stringify({
              startCountryCode: originCountryCode,
              endCountryCode: countryCode,
              zip: postalCode,
              houseNumber,
              products,
            }),
          },
        );

        options = extractFreightOptions(simpleResponse);
        diagnostics.push(...freightDiagnostics(simpleResponse));
      }
      catch (error) {
        diagnostics.push(
          `${originCountryCode}: ${errorText(error)}`,
        );
      }
    }

    for (const option of options) {
      const name = logisticsName(option);
      const amount = logisticsAmount(option);
      const optionError = clean(option.errorEn || option.error, 500);

      if (
        name &&
        Number.isFinite(amount) &&
        amount >= 0 &&
        !optionError
      ) {
        candidates.push({
          option,
          originCountryCode,
        });
      }
      else if (optionError) {
        diagnostics.push(`${originCountryCode}: ${optionError}`);
      }
    }
  }

  if (candidates.length === 0) {
    const tried = warehouseResult.origins.join(", ");
    const detail = [...new Set(diagnostics)]
      .filter(Boolean)
      .slice(0, 5)
      .join(" ");

    throw new Error(
      detail
        ? `No CJ shipping route to ${countryCode} was found from warehouses ${tried}. ${detail}`
        : `No CJ shipping route to ${countryCode} was found from warehouses ${tried}. This variant is not currently deliverable to the destination.`,
    );
  }

  const preferences = preferredLogisticsNames(input.items);
  const normalizedPreferences = preferences.map((name) =>
    name.toLowerCase(),
  );

  candidates.sort((left, right) => {
    const leftName = logisticsName(left.option).toLowerCase();
    const rightName = logisticsName(right.option).toLowerCase();
    const leftPreferred = normalizedPreferences.findIndex((preference) =>
      leftName.includes(preference) || preference.includes(leftName),
    );
    const rightPreferred = normalizedPreferences.findIndex((preference) =>
      rightName.includes(preference) || preference.includes(rightName),
    );

    if (leftPreferred >= 0 || rightPreferred >= 0) {
      if (leftPreferred < 0) return 1;
      if (rightPreferred < 0) return -1;
      if (leftPreferred !== rightPreferred) {
        return leftPreferred - rightPreferred;
      }
    }

    return (
      logisticsAmount(left.option) -
      logisticsAmount(right.option)
    );
  });

  const selected = candidates[0];

  return {
    name: logisticsName(selected.option),
    amountUsd: logisticsAmount(selected.option),
    delivery: deliveryWindow(selected.option),
    options: candidates.map((candidate) => candidate.option),
    originCountryCode: selected.originCountryCode,
  };
}

async function setFailure(orderId: string, error: unknown) {
  const sql = catalogSql();
  const message = errorText(error);
  await sql`
    UPDATE cj_order_fulfillments
    SET
      status = 'failed',
      last_error = ${message},
      locked_at = NULL,
      updated_at = NOW()
    WHERE order_id = ${orderId}
  `;
  return message;
}

async function unlock(orderId: string) {
  const sql = catalogSql();
  await sql`
    UPDATE cj_order_fulfillments
    SET locked_at = NULL, updated_at = NOW()
    WHERE order_id = ${orderId}
  `;
}

export async function prepareCJOrder(
  orderNumber: string,
  options?: { allowUnpaid?: boolean },
) {
  await ensureCJFulfillmentSchema();
  const { order, items } = await loadLocalOrder(orderNumber);
  const sql = catalogSql();

  if (
    !options?.allowUnpaid &&
    !["paid", "processing"].includes(order.status.toLowerCase())
  ) {
    throw new Error("The local order must be marked paid before it is sent to CJ.");
  }

  const isSandbox = envBoolean("CJ_ORDER_SANDBOX", true);

  await sql`
    INSERT INTO cj_order_fulfillments (
      order_id,
      local_order_number,
      status,
      stage,
      is_sandbox,
      created_at,
      updated_at
    )
    VALUES (
      ${order.id},
      ${order.orderNumber},
      'queued',
      'queued',
      ${isSandbox},
      NOW(),
      NOW()
    )
    ON CONFLICT (order_id) DO NOTHING
  `;

  const locked = await sql`
    UPDATE cj_order_fulfillments
    SET
      locked_at = NOW(),
      attempt_count = attempt_count + 1,
      status = CASE
        WHEN status IN ('awaiting_cj_payment', 'cj_processing', 'shipped', 'delivered')
          THEN status
        ELSE 'creating'
      END,
      last_error = NULL,
      updated_at = NOW()
    WHERE order_id = ${order.id}
      AND (
        locked_at IS NULL
        OR locked_at < NOW() - INTERVAL '5 minutes'
      )
    RETURNING order_id
  `;

  if (locked.length === 0) {
    const existing = await getFulfillmentByOrderId(order.id);
    if (existing && ["awaiting_cj_payment", "cj_processing", "shipped", "delivered"].includes(existing.status)) {
      return existing;
    }
    throw new Error("CJ fulfillment for this order is already running. Try again shortly.");
  }

  try {
    validateCJItems(items);
    let current = await getFulfillmentByOrderId(order.id);
    if (!current) throw new Error("Could not initialize the CJ fulfillment record.");

    let fromCountryCode =
      clean(current.originCountryCode, 2).toUpperCase() ||
      originCountry(items);

    let selectedLogistics = {
      name: current.logisticsName || "",
      amountUsd: current.logisticsCostUsd || 0,
      delivery: current.estimatedDelivery,
      options: [] as CJFreightOption[],
      originCountryCode: fromCountryCode,
    };

    if (!selectedLogistics.name) {
      selectedLogistics = await selectLogistics({
        order,
        items,
        fromCountryCode,
      });

      fromCountryCode = selectedLogistics.originCountryCode;

      await sql`
        UPDATE cj_order_fulfillments
        SET
          logistics_name = ${selectedLogistics.name},
          origin_country_code = ${fromCountryCode},
          logistics_cost_usd = ${selectedLogistics.amountUsd},
          estimated_delivery = ${selectedLogistics.delivery},
          updated_at = NOW()
        WHERE order_id = ${order.id}
      `;
    }

    current = (await getFulfillmentByOrderId(order.id)) || current;

    if (!current.cjOrderId) {
      const address = order.shippingAddress || {};
      const countryCode = clean(address.countryCode || "TZ", 2).toUpperCase();
      const countryName = clean(address.countryName || countryCode, 50);
      const province = clean(address.region || address.city || "Not specified", 50);
      const city = clean(address.city || province, 50);
      const postalCode = clean(
        address.postalCode || process.env.CJ_DEFAULT_POSTAL_CODE || "00000",
        20,
      );
      const storeName = clean(process.env.CJ_STORE_NAME, 50);

      const payload = {
        orderNumber: order.orderNumber,
        shippingZip: postalCode,
        shippingCountry: countryName,
        shippingCountryCode: countryCode,
        shippingProvince: province,
        shippingCity: city,
        shippingCounty: "",
        shippingPhone: phoneForCJ(
          clean(address.phone || order.customerPhone, 40),
        ),
        shippingCustomerName: clean(
          address.recipientName || order.customerName,
          50,
        ),
        shippingAddress: clean(address.addressLine1, 200),
        shippingAddress2: clean(address.addressLine2, 200),
        email: clean(order.customerEmail, 50),
        remark: clean(
          `WHOKEAS ALL IN ${order.orderNumber}. ${order.customerNotes || ""}`,
          500,
        ),
        logisticName: clean(selectedLogistics.name, 50),
        fromCountryCode,
        platform: "Api",
        shopLogisticsType: 2,
        orderFlow: 1,
        iossType: 1,
        isSandbox: isSandbox ? 1 : 0,
        storeOrderTime: Math.floor(new Date(order.createdAt).getTime() / 1000),
        ...(storeName ? { storeName } : {}),
        products: items.map((item) => ({
          vid: clean(item.cjVariantId, 50),
          quantity: item.quantity,
          storeLineItemId: item.id,
          ...(item.productId
            ? { storeProductId: clean(item.productId, 64) }
            : {}),
          ...(item.productImage
            ? { storeProductImg: clean(item.productImage, 500) }
            : {}),
          ...(item.variantName
            ? { variantOptions: clean(item.variantName, 200) }
            : {}),
        })),
      };

      const created = await cjRequest<CJCreateOrderData>(
        "/v1/shopping/order/createOrderV3",
        {
          method: "POST",
          headers: platformHeaders(),
          body: JSON.stringify(payload),
        },
      );

      const interceptReasons = Array.isArray(created.interceptOrderReasons)
        ? created.interceptOrderReasons
        : [];
      if (interceptReasons.length > 0) {
        throw new Error(
          interceptReasons
            .map((reason) => clean(reason.message || reason.code, 300))
            .filter(Boolean)
            .join("; ") || "CJ intercepted the order.",
        );
      }

      const cjOrderId = clean(created.orderId, 200);
      if (!cjOrderId) throw new Error("CJ created no order ID.");

      await sql`
        UPDATE cj_order_fulfillments
        SET
          status = 'created',
          stage = 'created',
          cj_order_id = ${cjOrderId},
          shipment_order_id = ${clean(created.shipmentOrderId, 200) || null},
          cj_order_status = ${clean(created.orderStatus, 100) || 'CREATED'},
          cj_pay_url = ${clean(created.cjPayUrl, 2000) || null},
          create_response = ${JSON.stringify(created)}::jsonb,
          updated_at = NOW()
        WHERE order_id = ${order.id}
      `;
    }

    current = (await getFulfillmentByOrderId(order.id)) || current;
    if (!current.cjOrderId) throw new Error("CJ order ID is unavailable.");

    if (!stageAtLeast(current.stage, "cart_added")) {
      const cart = await cjRequest<CJAddCartData>(
        "/v1/shopping/order/addCart",
        {
          method: "POST",
          headers: platformHeaders(),
          body: JSON.stringify({ cjOrderIdList: [current.cjOrderId] }),
        },
      );

      const cartIntercepted = Array.isArray(cart.interceptOrders)
        ? cart.interceptOrders
        : [];
      const cartSucceeded =
        Number(cart.successCount || 0) > 0 ||
        (Array.isArray(cart.addSuccessOrders) &&
          cart.addSuccessOrders.includes(current.cjOrderId));

      if (!cartSucceeded || cartIntercepted.length > 0) {
        throw new Error(
          `CJ could not add the order to cart${
            cartIntercepted.length > 0
              ? `: ${JSON.stringify(cartIntercepted).slice(0, 1000)}`
              : "."
          }`,
        );
      }

      await sql`
        UPDATE cj_order_fulfillments
        SET
          status = 'created',
          stage = 'cart_added',
          cart_response = ${JSON.stringify(cart)}::jsonb,
          updated_at = NOW()
        WHERE order_id = ${order.id}
      `;
    }

    current = (await getFulfillmentByOrderId(order.id)) || current;

    if (!stageAtLeast(current.stage, "cart_confirmed")) {
      const confirmation = await cjRequest<CJConfirmCartData>(
        "/v1/shopping/order/addCartConfirm",
        {
          method: "POST",
          headers: platformHeaders(),
          body: JSON.stringify({ cjOrderIdList: [current.cjOrderId] }),
        },
      );

      const confirmIntercepted = Array.isArray(confirmation.interceptOrders)
        ? confirmation.interceptOrders
        : [];
      const confirmationSucceeded =
        confirmation.submitSuccess === true ||
        Number(confirmation.successCount || 0) > 0;

      if (!confirmationSucceeded || confirmIntercepted.length > 0) {
        throw new Error(
          `CJ could not confirm the cart${
            confirmIntercepted.length > 0
              ? `: ${JSON.stringify(confirmIntercepted).slice(0, 1000)}`
              : "."
          }`,
        );
      }

      const shipmentOrderId =
        clean(confirmation.shipmentsId, 200) || current.shipmentOrderId;

      await sql`
        UPDATE cj_order_fulfillments
        SET
          status = 'created',
          stage = 'cart_confirmed',
          shipment_order_id = ${shipmentOrderId || null},
          confirm_response = ${JSON.stringify(confirmation)}::jsonb,
          updated_at = NOW()
        WHERE order_id = ${order.id}
      `;
    }

    current = (await getFulfillmentByOrderId(order.id)) || current;
    if (!current.shipmentOrderId) {
      throw new Error(
        "CJ did not return a shipment order ID. Open My CJ and review this order before retrying.",
      );
    }

    if (!stageAtLeast(current.stage, "awaiting_cj_payment")) {
      const parent = await cjRequest<CJParentOrderData>(
        "/v1/shopping/order/saveGenerateParentOrder",
        {
          method: "POST",
          headers: platformHeaders(),
          body: JSON.stringify({ shipmentOrderId: current.shipmentOrderId }),
        },
      );

      if (parent.submitSuccess === false) {
        throw new Error("CJ could not generate the payment order.");
      }

      const unmatched = [
        ...(Array.isArray(parent.unMatchOrderCodes)
          ? parent.unMatchOrderCodes
          : []),
        ...(Array.isArray(parent.unMatchProductCodes)
          ? parent.unMatchProductCodes
          : []),
      ];
      if (unmatched.length > 0) {
        throw new Error(`CJ could not match: ${unmatched.join(", ")}`);
      }

      const payable = cjNumber(
        parent.paymentInformation?.payableAmount ??
          parent.paymentInformation?.actualPayment ??
          parent.orderMoney,
      );

      await sql`
        UPDATE cj_order_fulfillments
        SET
          status = 'awaiting_cj_payment',
          stage = 'awaiting_cj_payment',
          pay_id = ${clean(parent.payId, 200) || null},
          payable_amount_usd = ${payable > 0 ? payable : null},
          parent_response = ${JSON.stringify(parent)}::jsonb,
          last_error = NULL,
          updated_at = NOW()
        WHERE order_id = ${order.id}
      `;
    }

    await unlock(order.id);
    return await getFulfillmentByOrderId(order.id);
  } catch (error) {
    await setFailure(order.id, error);
    throw error;
  }
}

export async function syncCJOrder(orderNumber: string) {
  await ensureCJFulfillmentSchema();
  const { order } = await loadLocalOrder(orderNumber);
  const current = await getFulfillmentByOrderId(order.id);
  if (!current?.cjOrderId) {
    throw new Error("This order has not been sent to CJ yet.");
  }

  const detail = await cjRequest<CJOrderDetail>(
    `/v1/shopping/order/getOrderDetail?orderId=${encodeURIComponent(
      current.cjOrderId,
    )}`,
    { method: "GET", headers: platformHeaders() },
  );

  const cjStatus = clean(detail.orderStatus, 100);
  const status = fulfillmentStatusFromCJ(cjStatus);
  const trackNumber = clean(detail.trackNumber, 200) || null;
  let trackingUrl = clean(detail.trackingUrl, 2000) || null;
  let trackingProvider = clean(detail.trackingProvider, 200) || null;
  let trackingResponse: CJTrackingInfo[] | null = null;

  if (trackNumber) {
    try {
      trackingResponse = await cjRequest<CJTrackingInfo[]>(
        `/v1/logistic/trackInfo?trackNumber=${encodeURIComponent(trackNumber)}`,
        { method: "GET", headers: platformHeaders() },
      );
      const first = Array.isArray(trackingResponse) ? trackingResponse[0] : null;
      trackingProvider =
        trackingProvider ||
        clean(first?.lastMileCarrier || first?.logisticName, 200) ||
        null;
      trackingUrl = trackingUrl || `https://cjpacket.com/?track=${encodeURIComponent(trackNumber)}`;
    } catch {
      // Order detail remains authoritative even when the tracking endpoint is delayed.
    }
  }

  const sql = catalogSql();
  await sql`
    UPDATE cj_order_fulfillments
    SET
      status = ${status},
      cj_order_status = ${cjStatus || null},
      logistics_name = COALESCE(${clean(detail.logisticName, 200) || null}, logistics_name),
      payable_amount_usd = COALESCE(
        ${cjNumber(detail.orderAmount) > 0 ? cjNumber(detail.orderAmount) : null},
        payable_amount_usd
      ),
      tracking_number = ${trackNumber},
      tracking_provider = ${trackingProvider},
      tracking_url = ${trackingUrl},
      detail_response = ${JSON.stringify({ detail, trackingResponse })}::jsonb,
      last_error = NULL,
      last_synced_at = NOW(),
      updated_at = NOW()
    WHERE order_id = ${order.id}
  `;

  if (!current.isSandbox) {
    if (status === "cj_processing") {
      await sql`
        UPDATE orders
        SET status = 'processing', updated_at = NOW()
        WHERE id = ${order.id}
          AND status::text IN ('paid', 'processing')
      `;
    } else if (status === "shipped") {
      await sql`
        UPDATE orders
        SET status = 'shipped', updated_at = NOW()
        WHERE id = ${order.id}
          AND status::text <> 'delivered'
      `;
    } else if (status === "delivered") {
      await sql`
        UPDATE orders
        SET status = 'delivered', updated_at = NOW()
        WHERE id = ${order.id}
      `;
    }
  }

  return await getFulfillmentByOrderId(order.id);
}

export async function syncPendingCJFulfillments(limit = 15) {
  await ensureCJFulfillmentSchema();
  const sql = catalogSql();
  const safeLimit = Math.max(1, Math.min(30, Math.floor(limit)));
  const rows = await sql`
    SELECT local_order_number AS "orderNumber"
    FROM cj_order_fulfillments
    WHERE cj_order_id IS NOT NULL
      AND status NOT IN ('delivered', 'cancelled')
    ORDER BY COALESCE(last_synced_at, created_at) ASC
    LIMIT ${safeLimit}
  `;

  const results: Array<{
    orderNumber: string;
    ok: boolean;
    status?: string;
    error?: string;
  }> = [];

  for (const row of rows) {
    const orderNumber = String(row.orderNumber);
    try {
      const record = await syncCJOrder(orderNumber);
      results.push({
        orderNumber,
        ok: true,
        status: record?.status || "unknown",
      });
    } catch (error) {
      results.push({ orderNumber, ok: false, error: errorText(error) });
    }
  }

  return {
    checked: results.length,
    succeeded: results.filter((result) => result.ok).length,
    failed: results.filter((result) => !result.ok).length,
    results,
  };
}
