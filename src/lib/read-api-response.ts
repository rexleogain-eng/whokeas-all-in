export async function readApiResponse<T = Record<string, unknown>>(
  response: Response,
): Promise<T> {
  const text = await response.text();
  let payload: unknown = {};

  if (text.trim()) {
    try {
      payload = JSON.parse(text);
    } catch {
      const preview = text
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 500);

      throw new Error(
        `Server returned HTTP ${response.status} instead of JSON: ${
          preview || "Empty server response"
        }`,
      );
    }
  }

  if (!response.ok) {
    const body = payload as {
      error?: unknown;
      message?: unknown;
      detail?: unknown;
    };

    throw new Error(
      String(
        body.error ??
          body.message ??
          body.detail ??
          `Request failed with HTTP ${response.status}.`,
      ),
    );
  }

  return payload as T;
}
