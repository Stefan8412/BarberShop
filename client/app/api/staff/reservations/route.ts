import { NextResponse } from "next/server";
import { DateTime } from "luxon";
import { currentStaff, publicStaff } from "@/lib/auth";
import { AppError, getBarber, ZONE } from "@/lib/booking";
import { listReservations } from "@/lib/calendar";
import { failure } from "@/lib/http";
export async function GET(request: Request) {
  try {
    const account = await currentStaff();
    if (!account) throw new AppError("Prihláste sa do svojho účtu.", 401);
    const input = new URL(request.url).searchParams.get("date");
    const date = input || DateTime.now().setZone(ZONE).toISODate()!;
    const day = DateTime.fromISO(date, { zone: ZONE }).startOf("day");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !day.isValid) throw new AppError("Neplatný dátum.");
    // Calendar is always resolved from the authenticated account, never query input.
    const reservations = await listReservations(getBarber(account.barberId), day);
    return NextResponse.json({ staff: publicStaff(account), date, reservations }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) { return failure(error); }
}
