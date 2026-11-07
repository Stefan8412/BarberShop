import { NextResponse } from "next/server";
import { authenticateStaff, cookieOptions, publicStaff, SESSION_COOKIE, signStaffSession } from "@/lib/auth";
import { body, failure, sameOrigin } from "@/lib/http";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const data = await body(request);
    const account = await authenticateStaff(data.email, data.password);
    const response = NextResponse.json({ staff: publicStaff(account) }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(SESSION_COOKIE, signStaffSession(account), cookieOptions());
    return response;
  } catch (error) { return failure(error); }
}
