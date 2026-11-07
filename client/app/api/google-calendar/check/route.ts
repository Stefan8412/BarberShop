import { NextResponse } from "next/server";
import { bookingDay, getBarber, getService, validateServiceBarber } from "@/lib/booking";
import { busyTimes } from "@/lib/calendar";
import { body, failure, sameOrigin } from "@/lib/http";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const data = await body(request);
    const barber = getBarber(data.barberId);
    const service = getService(data.serviceId);
    validateServiceBarber(barber, service);
    const bookedTimes = await busyTimes(barber, bookingDay(data.date), service.duration);
    return NextResponse.json({ bookedTimes }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}
