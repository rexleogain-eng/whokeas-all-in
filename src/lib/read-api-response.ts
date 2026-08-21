export async function readApiResponse<T = unknown>(
  response: Response,
): Promise<T> {
  const rawText = await response.text();
  let payload: unknown = {};

  if (rawText.trim()) {
    try {
      payload = JSON.parse(rawText);
    } catch {
      const preview = rawText
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
    const errorPayload =
      payload && typeof payload === "object"
        ? payload as Record<string, unknown>
        : {};

    throw new Error(
      String(
        errorPayload.error ??
          errorPayload.message ??
          errorPayload.detail ??
          `Request failed with HTTP ${response.status}.`,
      ),
    );
  }

  return payload as T;
}
