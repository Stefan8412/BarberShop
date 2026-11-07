import { NextResponse } from "next/server";
export async function POST() {
  return NextResponse.json({ error: "SMS overenie už nie je potrebné. Rezervujte zadaním mena a telefónu." }, { status: 410 });
}
