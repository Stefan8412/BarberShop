import { DateTime } from "luxon";
import { BarberTier, SERVICES, Service, serviceTimes } from "./services";

export const ZONE = "Europe/Bratislava";
export const DURATION = 45;
export const TIMES = Array.from({ length: 16 }, (_, i) => {
  const minutes = 9 * 60 + i * DURATION;
  return `${Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0")}:${(minutes % 60).toString().padStart(2, "0")}`;
});

export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export type Barber = {
  id: string;
  name: string;
  calendarId: string;
  tier: BarberTier;
};

export function getBarbers(): Barber[] {
  let value: unknown;
  try {
    value = process.env.BARBERS_JSON
      ? JSON.parse(process.env.BARBERS_JSON)
      : [
          {
            id: "adam",
            name: "Adam",
            calendarId:
              process.env.GOOGLE_CALENDAR_ADAM_ID ||
              process.env.GOOGLE_CALENDAR_ID ||
              "",
            tier: "senior",
          },
          {
            id: "barberina",
            name: "Barberina",
            calendarId: process.env.GOOGLE_CALENDAR_JURAJ_ID || "",
            tier: "senior",
          },
          {
            id: "martin-centko",
            name: "Martin Centko",
            calendarId: process.env.GOOGLE_CALENDAR_STEFAN_ID || "",
            tier: "barber",
          },
        ];
  } catch {
    throw new AppError("Konfigurácia kaderníkov nie je správna.", 503);
  }
  const source = process.env.BARBERS_JSON ? "BARBERS_JSON" : "client/lib/booking.ts";
  if (!Array.isArray(value) || value.length === 0) {
    throw new AppError(`V ${source} musí byť zoznam aspoň jedného kaderníka.`, 503);
  }
  for (const [index, barber] of value.entries()) {
    const label = typeof barber?.name === "string" && barber.name.trim()
      ? barber.name : `záznam ${index + 1}`;
    if (!barber || typeof barber.id !== "string" || !/^[a-z0-9-]{1,40}$/.test(barber.id)) {
      throw new AppError(`Kaderník ${label}: neplatné id v ${source}. Použite 1 až 40 malých písmen bez diakritiky, číslic alebo pomlčiek, bez medzier (napr. martin-centko).`, 503);
    }
    if (typeof barber.name !== "string" || !barber.name.trim()) {
      throw new AppError(`Kaderník s id ${barber.id}: doplňte meno v ${source}.`, 503);
    }
    if (typeof barber.calendarId !== "string" || (barber.calendarId !== "" && !barber.calendarId.trim())) {
      throw new AppError(`Kaderník ${label}: calendarId v ${source} musí byť text alebo prázdny reťazec.`, 503);
    }
    if (barber.tier !== undefined && barber.tier !== "senior" && barber.tier !== "barber") {
      throw new AppError(`Kaderník ${label}: tier v ${source} musí byť senior alebo barber.`, 503);
    }
  }
  if (new Set(value.map(b => b.id)).size !== value.length) {
    throw new AppError(`Každý kaderník musí mať jedinečné id v ${source}.`, 503);
  }
  const configured = value.filter(b => b.calendarId);
  if (new Set(configured.map(b => b.calendarId)).size !== configured.length) {
    throw new AppError(`Viacerí kaderníci používajú rovnaký kalendár v ${source}. Každý potrebuje vlastný kalendár.`, 503);
  }
  return value.map((b) => ({
    ...b,
    tier: b.tier || (b.id === "adam" ? "senior" : "barber"),
  }));
}

export function getBarber(id: unknown) {
  const barber = getBarbers().find((b) => b.id === id);
  if (!barber) throw new AppError("Vyberte platného kaderníka.");
  if (!barber.calendarId)
    throw new AppError(
      `Kalendár pre kaderníka ${barber.name} ešte nie je nastavený.`,
      503,
    );
  return barber;
}

export function bookingDay(date: unknown) {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    throw new AppError("Neplatný dátum.");
  const day = DateTime.fromISO(date, { zone: ZONE }).startOf("day");
  if (
    !day.isValid ||
    day < DateTime.now().setZone(ZONE).startOf("day") ||
    day.weekday === 7
  ) {
    throw new AppError("Vyberte budúci termín od pondelka do soboty.");
  }
  return day;
}

export function getService(id: unknown): Service {
  const service = SERVICES.find((s) => s.id === id);
  if (!service) throw new AppError("Vyberte platnú službu.");
  return service;
}

export function validateServiceBarber(barber: Barber, service: Service) {
  if (barber.tier !== service.tier)
    throw new AppError("Vybraný kaderník túto službu neposkytuje.");
}

export function bookingStart(
  date: unknown,
  time: unknown,
  duration = DURATION,
) {
  const day = bookingDay(date);
  if (typeof time !== "string" || !serviceTimes(duration).includes(time))
    throw new AppError("Neplatný čas.");
  const [hour, minute] = time.split(":").map(Number);
  const start = day.set({ hour, minute });
  if (start <= DateTime.now()) throw new AppError("Tento termín už uplynul.");
  return start;
}

export function normalizePhone(value: unknown) {
  if (typeof value !== "string") throw new AppError("Zadajte telefónne číslo.");
  let phone = value.replace(/[\s()-]/g, "");
  if (phone.startsWith("00")) phone = `+${phone.slice(2)}`;
  if (/^09\d{8}$/.test(phone)) phone = `+421${phone.slice(1)}`;
  if (!/^\+[1-9]\d{7,14}$/.test(phone))
    throw new AppError(
      "Zadajte číslo aj s predvoľbou, napr. +421 9xx xxx xxx.",
    );
  return phone;
}

export function overlaps(
  start: number,
  end: number,
  busyStart: number,
  busyEnd: number,
) {
  return start < busyEnd && end > busyStart;
}
