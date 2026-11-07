import { NextResponse } from "next/server";
import { cookieOptions, currentStaff, publicStaff, SESSION_COOKIE } from "@/lib/auth";
import { failure, sameOrigin } from "@/lib/http";
export async function GET() {
  try {
    const staff = await currentStaff();
    return NextResponse.json({ staff: staff ? publicStaff(staff) : null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}
export async function DELETE(request: Request) {
  try {
    sameOrigin(request);
    const response = NextResponse.json({ success: true });
    response.cookies.set(SESSION_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
    return response;
  } catch (error) { return failure(error); }
}
