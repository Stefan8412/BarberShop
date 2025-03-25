import { google } from "googleapis";
import { NextResponse } from "next/server";
import path from "path";

const KEY_FILE_PATH = path.join(process.cwd(), "service-account.json");
const SCOPES = ["https://www.googleapis.com/auth/calendar.events"];

export async function POST(req: Request) {
  try {
    const { date, time } = await req.json();

    if (!date || !time) {
      console.log('Faltan datos: ', { date, time });
      return NextResponse.json({ error: "Fecha y hora requeridas" }, { status: 400 });
    }

    const eventDateTime = new Date(`${date}T${time}:00`);
    console.log('Fecha y hora del evento: ', eventDateTime);

    const auth = new google.auth.GoogleAuth({
      keyFile: KEY_FILE_PATH,
      scopes: SCOPES,
    });

    const calendar = google.calendar({ version: "v3", auth });

    const event = {
      summary: "Reserva en BarberShop",
      description: "Turno reservado desde la app",
      start: {
        dateTime: eventDateTime.toISOString(),
        timeZone: "Europe/Madrid",
      },
      end: {
        dateTime: new Date(eventDateTime.getTime() + 60 * 60 * 1000).toISOString(),
        timeZone: "Europe/Madrid",
      },
    };

    console.log('Evento a agregar: ', event);

    const response = await calendar.events.insert({
      calendarId: "primary",
      requestBody: event,
    });

    console.log('Evento creado: ', response.data);

    return NextResponse.json({ success: true, eventId: response.data.id });
  } catch (error) {
    console.error("Error al agregar evento:", error);
    return NextResponse.json({ error: "No se pudo reservar" }, { status: 500 });
  }
}

