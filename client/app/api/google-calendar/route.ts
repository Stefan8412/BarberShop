import { NextResponse } from "next/server";
import { AppError, bookingStart, getBarber, getService, validateServiceBarber, normalizePhone } from "@/lib/booking";
import { insertBooking } from "@/lib/calendar";
import { body, failure, sameOrigin } from "@/lib/http";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const data = await body(request);
    const phone = normalizePhone(data.phone);
    const barber = getBarber(data.barberId);
    const service = getService(data.serviceId);
    validateServiceBarber(barber, service);
    const start = bookingStart(data.date, data.time, service.duration);
    if (typeof data.name !== "string" || data.name.trim().length < 2 || data.name.trim().length > 100 || /[\r\n\x00-\x1f]/.test(data.name)) {
      throw new AppError("Zadajte meno v rozsahu 2 až 100 znakov.");
    }
    const eventId = await insertBooking(barber, start, data.name.trim(), phone, service);
    return NextResponse.json({ eventId });
  } catch (error) { return failure(error); }
}
