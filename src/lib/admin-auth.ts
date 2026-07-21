import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE_NAME = "wai_admin";

function getExpectedToken() {
  const secret = process.env.ADMIN_SECRET;

  if (!secret) {
    return null;
  }

  return createHash("sha256")
    .update(`whokeas-admin-v1:${secret}`)
    .digest("hex");
}

export function verifyAdminSecret(candidate: string) {
  const secret = process.env.ADMIN_SECRET;

  if (!secret || !candidate) {
    return false;
  }

  const expected = Buffer.from(secret);
  const received = Buffer.from(candidate);

  if (expected.length !== received.length) {
    return false;
  }

  return timingSafeEqual(expected, received);
}

export async function isAdmin() {
  const expected = getExpectedToken();

  if (!expected) {
    return false;
  }

  const cookieStore = await cookies();
  const current = cookieStore.get(ADMIN_COOKIE_NAME)?.value;

  if (!current) {
    return false;
  }

  const expectedBuffer = Buffer.from(expected);
  const currentBuffer = Buffer.from(current);

  if (expectedBuffer.length !== currentBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, currentBuffer);
}

export function getAdminCookieValue() {
  return getExpectedToken();
}