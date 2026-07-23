export async function readApiResponse<T = Record<string, unknown>>(
  response: Response,
): Promise<T> {
  const responseText = await response.text();
  let payload: unknown = {};

  if (responseText.trim()) {
    try {
      payload = JSON.parse(responseText);
    } catch {
      const preview = responseText.replace(/\s+/g, " ").slice(0, 400);

      throw new Error(
        `Server returned HTTP ${response.status} instead of JSON: ${
          preview || "Empty server response"
        }`,
      );
    }
  }

  if (!response.ok) {
    const errorPayload = payload as {
      error?: unknown;
      message?: unknown;
    };

    throw new Error(
      String(
        errorPayload.error ??
          errorPayload.message ??
          `Request failed with HTTP ${response.status}.`,
      ),
    );
  }

  return payload as T;
}
