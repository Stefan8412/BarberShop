import { NextResponse } from "next/server";
import { google } from "googleapis";
import { DateTime } from "luxon";

const SCOPES = ["https://www.googleapis.com/auth/calendar"];

const credentials = {
  type: process.env.GOOGLE_TYPE,
  project_id: process.env.GOOGLE_PROJECT_ID,
  private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
  private_key: process.env.GOOGLE_PRIVATE_KEY,
  client_email: process.env.GOOGLE_CLIENT_EMAIL,
  client_id: process.env.GOOGLE_CLIENT_ID,
  auth_uri: process.env.GOOGLE_AUTH_URI,
  token_uri: process.env.GOOGLE_TOKEN_URI,
  auth_provider_x509_cert_url: process.env.GOOGLE_AUTH_PROVIDER_X509_CERT_URL,
  client_x509_cert_url: process.env.GOOGLE_CLIENT_X509_CERT_URL,
};

const auth = new google.auth.JWT(
  credentials.client_email,
  undefined,
  credentials.private_key,
  SCOPES
);

const calendar = google.calendar({ version: "v3", auth });

export async function POST(request: Request) {
  try {
    const { date, time, userData } = await request.json();

    // Ensure time has proper format with leading zeros
    //const formattedTime = time.padStart(8, "0");

    const startTime = DateTime.fromISO(`${date}T${time}`, {
      zone: "Europe/Madrid",
    });
    if (!startTime.isValid) {
      throw new Error(`Invalid date/time: ${startTime.invalidExplanation}`);
    }
    const endTime = startTime.plus({ minutes: 45 }); // or 45 if needed

    const event = {
      summary: `Rezervacia ${userData.name}`,
      description: `Klient: ${userData.name}\nMobil: ${userData.phone}`,
      start: {
        dateTime: startTime.toISO(),
        timeZone: "Europe/Madrid",
      },
      end: {
        dateTime: endTime.toISO(),
        timeZone: "Europe/Madrid",
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: "popup", minutes: 30 },
          { method: "email", minutes: 30 },
        ],
      },
    };

    const response = await calendar.events.insert({
      calendarId: process.env.GOOGLE_CALENDAR_ID,
      requestBody: event,
    });

    return NextResponse.json({ eventId: response.data.id });
  } catch (err) {
    return NextResponse.json(
      { error: "Chyba pri spracovaní rezervácie: ", err },
      { status: 500 }
    );
  }
}
