import { NextResponse } from "next/server";
import { AppError } from "./booking";

export function sameOrigin(request: Request) {
  const expected = process.env.APP_ORIGIN || new URL(request.url).origin;
  if (request.headers.get("origin") !== expected) throw new AppError("Nepovolená požiadavka.", 403);
}

export async function body(request: Request): Promise<Record<string, unknown>> {
  let data;
  try { data = await request.json(); } catch { throw new AppError("Neplatná požiadavka."); }
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new AppError("Neplatná požiadavka.");
  return data;
}

export function failure(error: unknown) {
  if (error instanceof AppError) return NextResponse.json({ error: error.message }, { status: error.status });
  // Never expose provider responses, credentials or customer details to the browser/logs.
  return NextResponse.json({ error: "Služba je dočasne nedostupná. Skúste to znova." }, { status: 503 });
}
