export async function readApiResponse<T = any>(
  response: Response,
): Promise<T> {
  const rawText = await response.text();
  let payload: any = {};

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
    throw new Error(
      String(
        payload?.error ??
          payload?.message ??
          payload?.detail ??
          `Request failed with HTTP ${response.status}.`,
      ),
    );
  }

  return payload as T;
}