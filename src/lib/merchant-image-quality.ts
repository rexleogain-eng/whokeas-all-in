import sharp from "sharp";

export const GOOGLE_MERCHANT_MIN_IMAGE_SIDE = 500;

const IMAGE_PROBE_BYTES = 384 * 1024;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const IMAGE_FETCH_TIMEOUT_MS = 15_000;

export type MerchantImageCheck = {
  url: string;
  width: number | null;
  height: number | null;
  ready: boolean;
  error: string | null;
};

export type MerchantImageSelection = {
  images: string[];
  primary: MerchantImageCheck | null;
  rejectedSmall: MerchantImageCheck[];
  unverified: MerchantImageCheck[];
};

function imageUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  }
  catch {
    return null;
  }
}

async function readLimitedBody(response: Response, maximumBytes: number) {
  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (declaredLength > maximumBytes) {
    throw new Error(`Image exceeds the ${maximumBytes}-byte safety limit.`);
  }

  if (!response.body) throw new Error("The image response was empty.");

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;

      totalBytes += value.byteLength;
      if (totalBytes > maximumBytes) {
        throw new Error(`Image exceeds the ${maximumBytes}-byte safety limit.`);
      }

      chunks.push(value);
    }
  }
  finally {
    try {
      await reader.cancel();
    }
    catch {
      // The stream may already be closed.
    }
  }

  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
}

async function fetchImageBytes(url: string, partial: boolean) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      redirect: "follow",
      headers: {
        Accept: "image/avif,image/webp,image/png,image/jpeg,image/*",
        ...(partial
          ? { Range: `bytes=0-${IMAGE_PROBE_BYTES - 1}` }
          : {}),
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Image returned HTTP ${response.status}.`);
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType && !contentType.toLowerCase().startsWith("image/")) {
      throw new Error(`Unexpected image content type: ${contentType}.`);
    }

    return readLimitedBody(
      response,
      partial ? IMAGE_PROBE_BYTES : MAX_IMAGE_BYTES,
    );
  }
  finally {
    clearTimeout(timeout);
  }
}

async function dimensions(bytes: Buffer) {
  const metadata = await sharp(bytes, {
    failOn: "none",
    limitInputPixels: 100_000_000,
  }).metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error("Image dimensions were unavailable.");
  }

  return {
    width: metadata.width,
    height: metadata.height,
  };
}

export async function checkMerchantImage(
  rawUrl: string,
): Promise<MerchantImageCheck> {
  const url = imageUrl(rawUrl);
  if (!url) {
    return {
      url: rawUrl,
      width: null,
      height: null,
      ready: false,
      error: "Image URL is invalid.",
    };
  }

  let partialError: unknown;

  try {
    const result = await dimensions(await fetchImageBytes(url, true));
    return {
      url,
      ...result,
      ready:
        result.width >= GOOGLE_MERCHANT_MIN_IMAGE_SIDE &&
        result.height >= GOOGLE_MERCHANT_MIN_IMAGE_SIDE,
      error: null,
    };
  }
  catch (error) {
    partialError = error;
  }

  try {
    const result = await dimensions(await fetchImageBytes(url, false));
    return {
      url,
      ...result,
      ready:
        result.width >= GOOGLE_MERCHANT_MIN_IMAGE_SIDE &&
        result.height >= GOOGLE_MERCHANT_MIN_IMAGE_SIDE,
      error: null,
    };
  }
  catch (error) {
    const message = error instanceof Error
      ? error.message
      : partialError instanceof Error
        ? partialError.message
        : "Image could not be verified.";

    return {
      url,
      width: null,
      height: null,
      ready: false,
      error: message,
    };
  }
}

export async function selectMerchantPrimaryImage(
  rawUrls: string[],
): Promise<MerchantImageSelection> {
  const images = [...new Set(
    rawUrls
      .map(imageUrl)
      .filter((url): url is string => Boolean(url)),
  )];
  const rejectedSmall: MerchantImageCheck[] = [];
  const unverified: MerchantImageCheck[] = [];

  for (const url of images) {
    const result = await checkMerchantImage(url);

    if (result.ready) {
      const rejectedUrls = new Set(rejectedSmall.map((item) => item.url));
      return {
        images: [
          result.url,
          ...images.filter(
            (image) => image !== result.url && !rejectedUrls.has(image),
          ),
        ],
        primary: result,
        rejectedSmall,
        unverified,
      };
    }

    if (result.width && result.height) rejectedSmall.push(result);
    else unverified.push(result);
  }

  const rejectedUrls = new Set(rejectedSmall.map((item) => item.url));

  return {
    images: images.filter((url) => !rejectedUrls.has(url)),
    primary: null,
    rejectedSmall,
    unverified,
  };
}
