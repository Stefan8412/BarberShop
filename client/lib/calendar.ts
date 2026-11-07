import { google } from "googleapis";
import { createHash } from "node:crypto";
import { DateTime } from "luxon";
import { Service, formatPrice, serviceTimes } from "./services";
import { AppError, Barber, DURATION, ZONE, overlaps } from "./booking";

function calendar() {
  const email = process.env.GOOGLE_CLIENT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !key) throw new AppError("Google Kalendár ešte nie je nakonfigurovaný.", 503);
  const auth = new google.auth.JWT({ email, key, scopes: ["https://www.googleapis.com/auth/calendar.events"] });
  return google.calendar({ version: "v3", auth });
}

export async function busyTimes(barber: Barber, day: DateTime, duration = DURATION) {
  const api = calendar();
  const intervals: { start: number; end: number }[] = [];
  let pageToken: string | undefined;
  do {
    const result = await api.events.list({
      calendarId: barber.calendarId, timeMin: day.toISO()!, timeMax: day.plus({ days: 1 }).toISO()!,
      singleEvents: true, maxResults: 2500, pageToken,
    });
    for (const event of result.data.items || []) {
      if (event.status === "cancelled" || event.transparency === "transparent") continue;
      const start = DateTime.fromISO(event.start?.dateTime || event.start?.date || "", { zone: ZONE });
      const end = DateTime.fromISO(event.end?.dateTime || event.end?.date || "", { zone: ZONE });
      if (!start.isValid || !end.isValid) throw new AppError("Dostupnosť sa nepodarilo overiť.", 503);
      intervals.push({ start: start.toMillis(), end: end.toMillis() });
    }
    pageToken = result.data.nextPageToken || undefined;
  } while (pageToken);
  return serviceTimes(duration).filter(time => {
    const [hour, minute] = time.split(":").map(Number);
    const start = day.set({ hour, minute });
    return intervals.some(b => overlaps(start.toMillis(), start.plus({ minutes: duration }).toMillis(), b.start, b.end));
  });
}

async function insertBookingUnlocked(barber: Barber, start: DateTime, name: string, phone: string, service: Service) {
  if ((await busyTimes(barber, start.startOf("day"), service.duration)).includes(start.toFormat("HH:mm"))) {
    throw new AppError("Tento termín je už obsadený. Vyberte si iný.", 409);
  }
  // The same barber/slot always uses the same ID, also across server instances.
  const id = createHash("sha256").update(`${barber.calendarId}:${start.toUTC().toISO()}`).digest("hex");
  try {
    const result = await calendar().events.insert({
      calendarId: barber.calendarId,
      requestBody: {
        id, summary: `${service.name} – ${name}`,
        description: `Služba: ${service.name}\nTrvanie: ${service.duration} min\nCena: ${formatPrice(service.price)}\nKaderník: ${barber.name}\nKlient: ${name}\nMobil: ${phone}`,
        extendedProperties: { private: {
          source: "barbershop", customerName: name, phone, serviceId: service.id,
          serviceName: service.name, price: String(service.price), duration: String(service.duration),
        } },
        start: { dateTime: start.toISO()!, timeZone: ZONE },
        end: { dateTime: start.plus({ minutes: service.duration }).toISO()!, timeZone: ZONE },
      },
    });
    return result.data.id;
  } catch (error) {
    if ((error as { code?: number }).code === 409) throw new AppError("Tento termín bol práve rezervovaný. Vyberte si iný.", 409);
    throw error;
  }
}

// Serialize different-duration requests for a calendar within this Node process.
// Multiple processes still need a shared transactional store for strict exclusion.
const bookingQueues = new Map<string, Promise<void>>();
export async function insertBooking(barber: Barber, start: DateTime, name: string, phone: string, service: Service) {
  const previous = bookingQueues.get(barber.calendarId) || Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>(resolve => { release = resolve; });
  bookingQueues.set(barber.calendarId, current);
  await previous;
  try { return await insertBookingUnlocked(barber, start, name, phone, service); }
  finally {
    release();
    if (bookingQueues.get(barber.calendarId) === current) bookingQueues.delete(barber.calendarId);
  }
}

export async function listReservations(barber: Barber, day: DateTime) {
  const api = calendar();
  const reservations: { id: string; title: string; start: string; end: string; allDay: boolean; customerName: string; phone: string; serviceName: string; price: number | null }[] = [];
  let pageToken: string | undefined;
  do {
    const result = await api.events.list({ calendarId: barber.calendarId, timeMin: day.toISO()!, timeMax: day.plus({ days: 1 }).toISO()!, singleEvents: true, orderBy: "startTime", maxResults: 2500, pageToken });
    for (const event of result.data.items || []) {
      if (event.status === "cancelled") continue;
      const details = event.extendedProperties?.private || {};
      const description = event.description || "";
      const price = details.price === undefined ? NaN : Number(details.price);
      reservations.push({
        id: event.id || "", title: event.summary || "Obsadený termín",
        start: event.start?.dateTime || event.start?.date || "", end: event.end?.dateTime || event.end?.date || "", allDay: !event.start?.dateTime,
        customerName: details.customerName || description.match(/^Klient: (.+)$/m)?.[1] || "",
        phone: details.phone || description.match(/^(?:Overený mobil|Mobil): (.+)$/m)?.[1] || "",
        serviceName: details.serviceName || description.match(/^Služba: (.+)$/m)?.[1] || "",
        price: Number.isFinite(price) && price >= 0 ? price : null,
      });
    }
    pageToken = result.data.nextPageToken || undefined;
  } while (pageToken);
  return reservations;
}
