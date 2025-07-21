import { google } from "googleapis";
import { NextResponse } from "next/server";
import path from "path";
import { DateTime } from "luxon";

const KEY_FILE_PATH = path.join(process.cwd(), "service-account.json");
const SCOPES = ["https://www.googleapis.com/auth/calendar.events"];

export async function POST(req: Request) {
  try {
    const { date, time } = await req.json();

    if (!date || !time) {
      console.log("Faltan datos: ", { date, time });
      return NextResponse.json(
        { error: "Požadovaný dátum a čas" },
        { status: 400 }
      );
    }

    const eventDateTime = DateTime.fromISO(`${date}T${time}`, {
      zone: "Europe/Madrid",
    });
    console.log("Dátum a čas podujatia: ", eventDateTime);

    const auth = new google.auth.GoogleAuth({
      keyFile: KEY_FILE_PATH,
      scopes: SCOPES,
    });

    const calendar = google.calendar({ version: "v3", auth });

    const event = {
      summary: "Rezervácia BarberShop",
      description: "Termín rezervovaný cez aplikáciu",
      start: {
        dateTime: eventDateTime.toISO(),
        timeZone: "Europe/Madrid",
      },
      end: {
        dateTime: eventDateTime.plus({ minutes: 45 }).toISO(),
        timeZone: "Europe/Madrid",
      },
    };

    console.log("Evento a agregar: ", event);

    const response = await calendar.events.insert({
      calendarId: "primary",
      requestBody: event,
    });

    console.log("Evento creado: ", response.data);

    return NextResponse.json({ success: true, eventId: response.data.id });
  } catch (error) {
    console.error("Error al agregar evento:", error);
    return NextResponse.json({ error: "No se pudo reservar" }, { status: 500 });
  }
}
