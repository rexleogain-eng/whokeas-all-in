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

export class CJRequestError extends Error {
  status: number;
  code: number | null;
  requestId: string | null;
  retryable: boolean;
  retryAfterMs: number | null;

  constructor(input: {
    message: string;
    status?: number;
    code?: number | null;
    requestId?: string | null;
    retryable?: boolean;
    retryAfterMs?: number | null;
  }) {
    super(input.message);
    this.name = "CJRequestError";
    this.status = input.status ?? 0;
    this.code = input.code ?? null;
    this.requestId = input.requestId ?? null;
    this.retryable = input.retryable === true;
    this.retryAfterMs = input.retryAfterMs ?? null;
  }
}

let tokenCache:
  | {
      token: string;
      expiresAt: number;
    }
  | undefined;
let tokenPromise: Promise<string> | null = null;

// CJ calls are deliberately serialized. Product import performs several
// expensive detail, variant and freight calls; one-at-a-time execution avoids
// QPS bursts and keeps the queue predictable on Vercel and local development.
let requestTail: Promise<void> = Promise.resolve();
let nextRequestAt = 0;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

function numberInRange(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

function minimumRequestIntervalMs() {
  return Math.floor(
    numberInRange(process.env.CJ_MIN_REQUEST_INTERVAL_MS, 1400, 500, 10000),
  );
}

function maximumRetries() {
  // A serverless request must finish quickly. Failed supplier calls are
  // returned to the database queue for a later invocation.
  return Math.floor(
    numberInRange(process.env.CJ_MAX_RETRIES, 1, 0, 1),
  );
}
function requestTimeoutMs() {
  return Math.floor(
    numberInRange(
      process.env.CJ_REQUEST_TIMEOUT_MS,
      12000,
      5000,
      20000,
    ),
  );
}

async function scheduledFetch(url: string, init: RequestInit) {
  let release!: () => void;
  const previous = requestTail;

  requestTail = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous;

  try {
    const waitMs = Math.max(0, nextRequestAt - Date.now());

    if (waitMs > 0) {
      await sleep(waitMs);
    }

    nextRequestAt = Date.now() + minimumRequestIntervalMs();

    const timeoutMs = requestTimeoutMs();
    const controller = new AbortController();
    const upstreamSignal = init.signal;
    let timedOut = false;

    const abortFromUpstream = () => {
      controller.abort();
    };

    if (upstreamSignal) {
      if (upstreamSignal.aborted) {
        abortFromUpstream();
      } else {
        upstreamSignal.addEventListener(
          "abort",
          abortFromUpstream,
          { once: true },
        );
      }
    }

    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    try {
      return await fetch(url, {
        ...init,
        signal: controller.signal,
      });
    } catch (error) {
      if (timedOut) {
        throw new CJRequestError({
          message: `CJ request timed out after ${timeoutMs} ms.`,
          retryable: true,
        });
      }

      throw error;
    } finally {
      clearTimeout(timer);

      if (upstreamSignal) {
        upstreamSignal.removeEventListener(
          "abort",
          abortFromUpstream,
        );
      }
    }
  } finally {
    release();
  }
}

function getApiKey() {
  const apiKey = process.env.CJ_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("CJ_API_KEY is missing.");
  }

  return apiKey;
}

async function parseEnvelope<T>(response: Response): Promise<CJEnvelope<T>> {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text) as CJEnvelope<T>;
  } catch {
    return {
      result: false,
      message: `CJ returned a non-JSON response (HTTP ${response.status}).`,
    };
  }
}

function retryAfterMs(response: Response) {
  const value = response.headers.get("retry-after")?.trim();
  if (!value) return null;

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(120000, seconds * 1000);
  }

  const date = new Date(value).getTime();
  if (!Number.isNaN(date)) {
    return Math.min(120000, Math.max(0, date - Date.now()));
  }

  return null;
}

function retryableMessage(message: string) {
  const normalized = message.toLowerCase();
  return [
    "too many",
    "throttle",
    "rate limit",
    "frequency",
    "temporarily",
    "busy",
    "timeout",
    "try again",
    "points",
    "network",
  ].some((term) => normalized.includes(term));
}

function isRetryableResponse<T>(response: Response, payload: CJEnvelope<T>) {
  if ([408, 409, 425, 429, 500, 502, 503, 504].includes(response.status)) {
    return true;
  }

  if (payload.code === 429 || payload.code === 1600200) return true;
  return retryableMessage(String(payload.message || ""));
}

function exponentialBackoff(attempt: number, suggested: number | null) {
  if (suggested && suggested > 0) return suggested;
  const base = Math.min(30000, 1800 * 2 ** Math.max(0, attempt));
  const jitter = Math.floor(Math.random() * 650);
  return base + jitter;
}

async function requestToken() {
  const response = await scheduledFetch(
    `${CJ_BASE}/v1/authentication/getAccessToken`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: getApiKey() }),
      cache: "no-store",
    },
  );

  const payload = await parseEnvelope<TokenData>(response);

  if (
    !response.ok ||
    payload.result === false ||
    payload.success === false ||
    !payload.data?.accessToken
  ) {
    throw new CJRequestError({
      message:
        payload.message ||
        `CJ authentication failed with HTTP ${response.status}.`,
      status: response.status,
      code: payload.code ?? null,
      requestId: payload.requestId ?? null,
      retryable: isRetryableResponse(response, payload),
      retryAfterMs: retryAfterMs(response),
    });
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

  if (forceRefresh) tokenCache = undefined;

  if (!tokenPromise) {
    tokenPromise = requestToken().finally(() => {
      tokenPromise = null;
    });
  }

  return tokenPromise;
}

async function makeRequest<T>(
  path: string,
  init: RequestInit,
  forceRefresh = false,
) {
  const token = await getCJAccessToken(forceRefresh);

  const response = await scheduledFetch(`${CJ_BASE}${path}`, {
    ...init,
    headers: {
      "CJ-Access-Token": token,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers || {}),
    },
    cache: "no-store",
  });

  const payload = await parseEnvelope<T>(response);
  return { response, payload };
}

export function isCJThrottleError(error: unknown) {
  return (
    error instanceof CJRequestError &&
    (error.retryable || error.status === 429 || retryableMessage(error.message))
  );
}

export async function cjRequest<T>(
  path: string,
  init: RequestInit = { method: "GET" },
): Promise<T> {
  const retries = maximumRetries();
  let authenticationRetried = false;
  let lastError: CJRequestError | null = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      let result = await makeRequest<T>(path, init);

      const authenticationFailed =
        result.response.status === 401 ||
        result.payload.code === 1600001 ||
        result.payload.message?.toLowerCase().includes("authentication");

      if (authenticationFailed && !authenticationRetried) {
        authenticationRetried = true;
        tokenCache = undefined;
        result = await makeRequest<T>(path, init, true);
      }

      const failed =
        !result.response.ok ||
        result.payload.result === false ||
        result.payload.success === false ||
        result.payload.data === undefined ||
        result.payload.data === null;

      if (!failed) return result.payload.data as T;

      const retryable = isRetryableResponse(
        result.response,
        result.payload,
      );
      const error = new CJRequestError({
        message:
          result.payload.message ||
          `CJ request failed with HTTP ${result.response.status}.`,
        status: result.response.status,
        code: result.payload.code ?? null,
        requestId: result.payload.requestId ?? null,
        retryable,
        retryAfterMs: retryAfterMs(result.response),
      });
      lastError = error;

      if (!retryable || attempt >= retries) throw error;
      await sleep(exponentialBackoff(attempt, error.retryAfterMs));
    } catch (error) {
      if (error instanceof CJRequestError) {
        lastError = error;
        if (!error.retryable || attempt >= retries) throw error;
        await sleep(exponentialBackoff(attempt, error.retryAfterMs));
        continue;
      }

      const networkError = new CJRequestError({
        message:
          error instanceof Error ? error.message : "CJ network request failed.",
        retryable: true,
      });
      lastError = networkError;
      if (attempt >= retries) throw networkError;
      await sleep(exponentialBackoff(attempt, null));
    }
  }

  throw lastError || new Error("CJ request failed.");
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
      Number(process.env.CJ_DEFAULT_MARGIN_PERCENT || 30),
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
  const marginRate = Math.min(0.85, Math.max(0, marginPercent / 100));
  return roundUp(landed / Math.max(0.05, 1 - marginRate));
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
