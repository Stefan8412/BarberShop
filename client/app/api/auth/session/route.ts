import { NextResponse } from "next/server";
// Old customer sessions have no authority; staff uses a different cookie and API.
export async function GET() { return NextResponse.json({ phone: null }, { headers: { "Cache-Control": "no-store" } }); }
