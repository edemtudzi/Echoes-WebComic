import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { requireEnv } from "@/lib/env";

export type SessionUser = {
  id: string;
  email: string;
  displayName: string;
  role: "reader" | "moderator" | "admin";
};

const COOKIE_NAME = "echoes_session";
const MAX_AGE = 60 * 60 * 24 * 30;

function base64url(value: string) {
  return Buffer.from(value).toString("base64url");
}

function fromBase64url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(payload: string) {
  return createHmac("sha256", requireEnv("AUTH_SECRET")).update(payload).digest("base64url");
}

export async function setSession(user: SessionUser) {
  const cookieStore = await cookies();
  const payload = base64url(JSON.stringify({ ...user, exp: Date.now() + MAX_AGE * 1000 }));
  const signature = sign(payload);

  cookieStore.set(COOKIE_NAME, `${payload}.${signature}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE,
    path: "/"
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getSessionUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const [payload, signature] = token.split(".");

  if (!payload || !signature) {
    return null;
  }

  const expected = sign(payload);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const parsed = JSON.parse(fromBase64url(payload)) as SessionUser & { exp: number };

    if (!parsed.exp || parsed.exp < Date.now()) {
      return null;
    }

    return {
      id: parsed.id,
      email: parsed.email,
      displayName: parsed.displayName,
      role: parsed.role
    };
  } catch {
    return null;
  }
}
