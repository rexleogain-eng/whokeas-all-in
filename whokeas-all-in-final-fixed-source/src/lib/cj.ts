const CJ_BASE = "https://developers.cjdropshipping.com/api2.0";

type CJEnvelope<T> = {
  code?: number;
  result?: boolean;
  success?: boolean;
  message?: string;
  data?: T;
  requestId?: string;
};

type TokenData = {
  accessToken: string;
  accessTokenExpiryDate?: string;
};

let tokenCache:
  | {
      token: string;
      expiresAt: number;
    }
  | undefined;

function getApiKey() {
  const apiKey = process.env.CJ_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("CJ_API_KEY is missing.");
  }

  return apiKey;
}

async function requestToken() {
  const response = await fetch(
    `${CJ_BASE}/v1/authentication/getAccessToken`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: getApiKey() }),
      cache: "no-store",
    },
  );

  const payload = (await response.json()) as CJEnvelope<TokenData>;

  if (
    !response.ok ||
    payload.result === false ||
    payload.success === false ||
    !payload.data?.accessToken
  ) {
    throw new Error(
      payload.message ||
        `CJ authentication failed with HTTP ${response.status}.`,
    );
  }

  const parsedExpiry = payload.data.accessTokenExpiryDate
    ? new Date(payload.data.accessTokenExpiryDate).getTime()
    : Date.now() + 6 * 60 * 60 * 1000;

  tokenCache = {
    token: payload.data.accessToken,
    expiresAt: Number.isFinite(parsedExpiry)
      ? parsedExpiry
      : Date.now() + 6 * 60 * 60 * 1000,
  };

  return tokenCache.token;
}

export async function getCJAccessToken(forceRefresh = false) {
  if (
    !forceRefresh &&
    tokenCache &&
    tokenCache.expiresAt > Date.now() + 5 * 60 * 1000
  ) {
    return tokenCache.token;
  }

  return requestToken();
}

async function makeRequest<T>(
  path: string,
  init: RequestInit,
  forceRefresh = false,
) {
  const token = await getCJAccessToken(forceRefresh);

  const response = await fetch(`${CJ_BASE}${path}`, {
    ...init,
    headers: {
      "CJ-Access-Token": token,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers || {}),
    },
    cache: "no-store",
  });

  const payload = (await response.json()) as CJEnvelope<T>;

  return { response, payload };
}

export async function cjRequest<T>(
  path: string,
  init: RequestInit = { method: "GET" },
): Promise<T> {
  let result = await makeRequest<T>(path, init);

  const authenticationFailed =
    result.response.status === 401 ||
    result.payload.code === 1600001 ||
    result.payload.message?.toLowerCase().includes("authentication");

  if (authenticationFailed) {
    tokenCache = undefined;
    result = await makeRequest<T>(path, init, true);
  }

  if (
    !result.response.ok ||
    result.payload.result === false ||
    result.payload.success === false ||
    result.payload.data === undefined
  ) {
    throw new Error(
      result.payload.message ||
        `CJ request failed with HTTP ${result.response.status}.`,
    );
  }

  return result.payload.data;
}

export function cjNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function roundUp(value: number, increment = 500) {
  return Math.ceil(value / increment) * increment;
}

export function pricingDefaults() {
  return {
    usdToTzsRate: Math.max(
      1,
      Number(process.env.CJ_USD_TO_TZS_RATE || 2700),
    ),
    marginPercent: Math.max(
      0,
      Number(process.env.CJ_DEFAULT_MARGIN_PERCENT || 35),
    ),
    reserveTzs: Math.max(
      0,
      Number(process.env.CJ_RISK_RESERVE_TZS || 3000),
    ),
  };
}

export function calculateSellingPrice(
  supplierCostTzs: number,
  shippingTzs: number,
  reserveTzs: number,
  marginPercent: number,
) {
  const landed = supplierCostTzs + shippingTzs + reserveTzs;
  return roundUp(landed * (1 + marginPercent / 100));
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 130);
}

export function stripHtml(value: unknown, maximum = 5000) {
  if (typeof value !== "string") return "";

  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}