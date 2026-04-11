// Google Calendar integration — busca horarios libres y crea eventos con Google Meet

const { google } = require('googleapis');

const TZ = 'America/Argentina/Salta';
const MEETING_DURATION_MIN = 45;
// Horarios candidatos en hora Argentina (se buscan en orden hasta tener 3 slots)
const CANDIDATE_HOURS = [10, 11, 14, 15, 16, 17];

function getOAuth2Client() {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );
  client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return client;
}

// Devuelve la fecha como YYYY-MM-DD en zona horaria Argentina
function dateToARDay(date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(date);
}

// Busca los próximos 3 slots libres de 45 min en días hábiles (lun-vie, 9-19hs AR)
async function getAvailableSlots() {
  if (!process.env.GOOGLE_REFRESH_TOKEN) {
    throw new Error('GOOGLE_REFRESH_TOKEN no configurado — corré scripts/get-google-token.js');
  }

  const auth = getOAuth2Client();
  const calendar = google.calendar({ version: 'v3', auth });

  const now = new Date();
  const slots = [];
  let d = new Date(now);
  let daysChecked = 0;

  while (slots.length < 3 && daysChecked < 14) {
    const dayStr = dateToARDay(d); // "2026-04-14"

    // Día de semana en zona AR
    const weekdayEN = new Intl.DateTimeFormat('en', { timeZone: TZ, weekday: 'short' }).format(d);
    const isWeekend = weekdayEN === 'Sat' || weekdayEN === 'Sun';

    if (!isWeekend) {
      const dayEnd = new Date(`${dayStr}T19:00:00-03:00`);

      if (dayEnd > now) {
        const dayStart = new Date(`${dayStr}T09:00:00-03:00`);

        // Consultar periodos ocupados de Google Calendar
        const fbRes = await calendar.freebusy.query({
          requestBody: {
            timeMin: (dayStart > now ? dayStart : now).toISOString(),
            timeMax: dayEnd.toISOString(),
            items: [{ id: 'primary' }],
          },
        });
        const busy = fbRes.data.calendars?.primary?.busy || [];

        for (const hour of CANDIDATE_HOURS) {
          if (slots.length >= 3) break;

          const slotStart = new Date(`${dayStr}T${String(hour).padStart(2, '0')}:00:00-03:00`);
          const slotEnd = new Date(slotStart.getTime() + MEETING_DURATION_MIN * 60000);

          // Saltar si ya pasó
          if (slotStart <= now) continue;

          // Verificar que no hay conflicto
          const isBusy = busy.some(
            b => slotStart < new Date(b.end) && slotEnd > new Date(b.start)
          );

          if (!isBusy) slots.push({ start: slotStart, end: slotEnd });
        }
      }
    }

    d = new Date(d);
    d.setDate(d.getDate() + 1);
    daysChecked++;
  }

  return slots;
}

// Formatea los slots para mostrar por WhatsApp
function formatSlotsForWhatsApp(slots) {
  const MONTHS = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ];

  return slots.map((slot, i) => {
    const d = slot.start;
    const weekday = new Intl.DateTimeFormat('es-AR', { timeZone: TZ, weekday: 'long' }).format(d);
    const day = parseInt(new Intl.DateTimeFormat('en', { timeZone: TZ, day: 'numeric' }).format(d));
    const month = parseInt(new Intl.DateTimeFormat('en', { timeZone: TZ, month: 'numeric' }).format(d)) - 1;
    const time = new Intl.DateTimeFormat('es-AR', {
      timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(d);

    return `*${i + 1}.* ${weekday} ${day} de ${MONTHS[month]}, ${time}hs`;
  }).join('\n');
}

// Crea el evento en Google Calendar con Google Meet link
async function createMeetingEvent(slot, clientName, clientEmail) {
  if (!process.env.GOOGLE_REFRESH_TOKEN) {
    throw new Error('GOOGLE_REFRESH_TOKEN no configurado');
  }

  const auth = getOAuth2Client();
  const calendar = google.calendar({ version: 'v3', auth });

  const event = {
    summary: `Reunión con ${clientName} — DT Systems`,
    description: `Reunión de seguimiento con cliente ${clientName}.\nCoordinada vía WhatsApp por el asistente DT Systems.`,
    start: { dateTime: slot.start.toISOString(), timeZone: TZ },
    end: { dateTime: slot.end.toISOString(), timeZone: TZ },
    conferenceData: {
      createRequest: {
        requestId: `dtsy-${Date.now()}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    },
    attendees: clientEmail ? [{ email: clientEmail }] : [],
  };

  const res = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: event,
    conferenceDataVersion: 1,
    sendUpdates: clientEmail ? 'all' : 'none',
  });

  const meetLink =
    res.data.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video')?.uri || null;

  return { eventId: res.data.id, meetLink, htmlLink: res.data.htmlLink };
}

module.exports = { getAvailableSlots, formatSlotsForWhatsApp, createMeetingEvent };
