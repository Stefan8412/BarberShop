import { NextResponse } from 'next/server';
import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/calendar'];
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID;

const CREDENTIALS = {
  client_email: process.env.GOOGLE_CLIENT_EMAIL,
  private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

const auth = new google.auth.JWT(
  CREDENTIALS.client_email,
  undefined,
  CREDENTIALS.private_key,
  SCOPES
);

const calendar = google.calendar({ version: 'v3', auth });

export async function POST(request: Request) {
  try {
    const { date } = await request.json();
    
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const response = await calendar.events.list({
      calendarId: CALENDAR_ID,
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    const bookedTimes = response.data.items?.map(event => {
      const startTime = new Date(event.start?.dateTime || '');
      return startTime.getHours() + ':00';
    }) || [];

    return NextResponse.json({ bookedTimes });
  } catch (error) {
    return NextResponse.json(
      { error: 'Error al obtener los horarios disponibles', details: error },
      { status: 500 }
    );
  }
}