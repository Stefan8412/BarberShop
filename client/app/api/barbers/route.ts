import { NextResponse } from "next/server";
import { getBarbers } from "@/lib/booking";
import { failure } from "@/lib/http";
export async function GET() {
  try { return NextResponse.json({ barbers: getBarbers().map(({ id, name, tier }) => ({ id, name, tier })) }); }
  catch (error) { return failure(error); }
}
