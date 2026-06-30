import { neon } from "@neondatabase/serverless";
import { requireEnv } from "@/lib/env";

let cachedSql: ReturnType<typeof neon> | null = null;

export function getSql() {
  cachedSql ??= neon(requireEnv("DATABASE_URL"));
  return cachedSql;
}

export async function query<T = Record<string, unknown>>(text: string, params: unknown[] = []) {
  return getSql().query(text, params) as Promise<T[]>;
}

export async function one<T = Record<string, unknown>>(text: string, params: unknown[] = []) {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}
