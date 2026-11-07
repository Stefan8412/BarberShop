const { test } = require('node:test');
const { scryptSync } = require('node:crypto');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

// Load the actual TypeScript server code without an additional test dependency.
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, filename);
};
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (name, ...args) {
  if (name.startsWith('@/')) name = path.join(__dirname, '..', name.slice(2));
  return originalResolve.call(this, name, ...args);
};
let cookieToken;
let events = [];
let pages = [];
let inserts = [];
let conflict = false;
let recordEvents = false;
const originalLoad = Module._load;
Module._load = function (name, ...args) {
  if (name === 'next/headers') return { cookies: async () => ({ get: () => cookieToken ? { value: cookieToken } : undefined }) };
  if (name === 'googleapis') return { google: { auth: { JWT: class {} }, calendar: () => ({ events: {
    list: async options => { pages.push(options); return { data: { items: events } }; },
    insert: async options => { if (conflict) throw { code: 409 }; inserts.push(options); if (recordEvents) events.push(options.requestBody); return { data: { id: options.requestBody.id } }; },
  } }) } };
  return originalLoad.call(this, name, ...args);
};
process.env.SESSION_SECRET = 'test-secret-at-least-32-characters-long';
process.env.APP_ORIGIN = 'http://localhost:3000';
process.env.GOOGLE_CLIENT_EMAIL = 'test@example.com';
process.env.GOOGLE_PRIVATE_KEY = 'fake-key';
process.env.BARBERS_JSON = JSON.stringify([
  { id: 'one', name: 'Prvý', calendarId: 'calendar-one' },
  { id: 'two', name: 'Druhý', calendarId: 'calendar-two' },
]);
const testSalt = Buffer.alloc(16, 7);
const testHash = `scrypt$${testSalt.toString('hex')}$${scryptSync('test-password-123', testSalt, 64, { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 }).toString('hex')}`;
process.env.STAFF_ACCOUNTS_JSON = JSON.stringify([
  { barberId: 'one', email: 'one@example.com', passwordHash: testHash },
  { barberId: 'two', email: 'two@example.com', passwordHash: testHash },
]);
const booking = require('../lib/booking.ts');
const auth = require('../lib/auth.ts');
const calendar = require('../lib/calendar.ts');
const { DateTime } = require('luxon');
const reserve = require('../app/api/google-calendar/route.ts');
const legacy = require('../app/api/reserve/route.ts');
const verify = require('../app/api/auth/verify/route.ts');
const send = require('../app/api/auth/send/route.ts');
const request = (data, origin = 'http://localhost:3000') => new Request('http://localhost:3000/api/test', {
  method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(data),
});
const day = DateTime.now().setZone(booking.ZONE).plus({ days: 10 }).startOf('day');
const nextDay = day.weekday === 7 ? day.plus({ days: 1 }) : day;
const date = nextDay.toISODate();
const payload = { serviceId: 'barber-haircut', barberId: 'one', date, time: '09:00', name: 'Ján Test', phone: '+421900000000' };

test('phone normalization and validation', () => {
  assert.equal(booking.normalizePhone('0912 345 678'), '+421912345678');
  assert.equal(booking.normalizePhone('00421 912 345 678'), '+421912345678');
  assert.throws(() => booking.normalizePhone('abc'));
  assert.throws(() => booking.normalizePhone(null));
});

test('staff sessions reject tampering, expiry, missing cookies and credential changes', () => {
  const account = auth.staffAccounts()[0];
  const token = auth.signStaffSession(account, 1000);
  assert.equal(auth.readStaffSession(token, 2000).barberId, 'one');
  assert.equal(auth.readStaffSession(token, 1000 + auth.SESSION_SECONDS * 1000), null);
  assert.equal(auth.readStaffSession(token + 'x', 2000), null);
  assert.equal(auth.readStaffSession(undefined), null);
  const saved = process.env.STAFF_ACCOUNTS_JSON;
  try {
    const updated = JSON.parse(saved); updated[0].email = 'changed@example.com';
    process.env.STAFF_ACCOUNTS_JSON = JSON.stringify(updated);
    assert.equal(auth.readStaffSession(token, 2000), null);
  } finally { process.env.STAFF_ACCOUNTS_JSON = saved; }
});

test('configuration requires distinct barber and calendar IDs', () => {
  const saved = process.env.BARBERS_JSON;
  try {
    process.env.BARBERS_JSON = '[{"id":"a","name":"A","calendarId":"x"},{"id":"b","name":"B","calendarId":"x"}]';
    assert.throws(() => booking.getBarbers());
  } finally { process.env.BARBERS_JSON = saved; }
  assert.equal(booking.getBarbers().length, 2);
  assert.throws(() => booking.getBarber('missing'));
});

test('server rejects invalid dates, Sundays, past and off-grid times', () => {
  assert.throws(() => booking.bookingDay('2030-02-31'));
  assert.throws(() => booking.bookingDay('2020-01-01'));
  const sunday = nextDay.plus({ days: (7 - nextDay.weekday) % 7 });
  assert.throws(() => booking.bookingDay(sunday.toISODate()));
  assert.throws(() => booking.bookingStart(date, '09:15'));
  assert.equal(booking.bookingStart(date, '09:00').zoneName, booking.ZONE);
});

test('availability blocks overlaps and all-day events, ignores transparent/cancelled events', async () => {
  events = [{ start: { dateTime: `${date}T09:20:00+01:00` }, end: { dateTime: `${date}T10:00:00+01:00` } }];
  // Use zone-correct offsets for summer and winter.
  events[0].start.dateTime = nextDay.set({ hour: 9, minute: 20 }).toISO();
  events[0].end.dateTime = nextDay.set({ hour: 10 }).toISO();
  assert.deepEqual(await calendar.busyTimes(booking.getBarber('one'), nextDay), ['09:00', '09:45']);
  events = [{ start: { date }, end: { date: nextDay.plus({ days: 1 }).toISODate() } }];
  assert.equal((await calendar.busyTimes(booking.getBarber('one'), nextDay)).length, booking.TIMES.length);
  events[0].transparency = 'transparent';
  assert.deepEqual(await calendar.busyTimes(booking.getBarber('one'), nextDay), []);
  events[0].transparency = undefined; events[0].status = 'cancelled';
  assert.deepEqual(await calendar.busyTimes(booking.getBarber('one'), nextDay), []);
  assert.equal(booking.overlaps(0, 45, 45, 90), false);
  events = [];
});

test('both reservation endpoints accept customers without login and reject cross-origin calls', async () => {
  cookieToken = undefined;
  assert.equal((await reserve.POST(request(payload))).status, 200);
  assert.equal((await legacy.POST(request(payload))).status, 200);
  const before = inserts.length;
  assert.equal((await reserve.POST(request(payload, 'https://evil.example'))).status, 403);
  assert.equal(inserts.length, before);
  assert.equal((await reserve.POST(request({ ...payload, phone: '' }))).status, 400);
  assert.equal((await reserve.POST(request({ ...payload, phone: 'invalid' }))).status, 400);
  inserts = [];
});

test('booking selects the barber calendar and records customer phone; conflicts return 409', async () => {
  const response = await reserve.POST(request(payload));
  assert.equal(response.status, 200);
  assert.equal(inserts[0].calendarId, 'calendar-one');
  assert.ok(inserts[0].requestBody.description.includes(payload.phone));
  assert.ok(!inserts[0].requestBody.description.includes('Overený mobil'));
  const firstId = inserts[0].requestBody.id;
  await reserve.POST(request({ ...payload, barberId: 'two' }));
  assert.equal(inserts[1].calendarId, 'calendar-two');
  assert.notEqual(inserts[1].requestBody.id, firstId);
  conflict = true;
  assert.equal((await reserve.POST(request(payload))).status, 409);
  conflict = false;
  events = [{ start: { date }, end: { date: nextDay.plus({ days: 1 }).toISODate() } }];
  assert.equal((await reserve.POST(request(payload))).status, 409);
  events = [];
});

test('old SMS endpoints cannot send messages or charge Twilio', async () => {
  const originalFetch = global.fetch;
  global.fetch = () => { throw new Error('SMS provider must not be called'); };
  try {
    assert.equal((await send.POST()).status, 410);
    assert.equal((await verify.POST()).status, 410);
  } finally { global.fetch = originalFetch; }
});

test('default team uses Adam legacy calendar and never shares it with unconfigured barbers', () => {
  const saved = { ...process.env };
  try {
    delete process.env.BARBERS_JSON;
    delete process.env.GOOGLE_CALENDAR_ADAM_ID;
    delete process.env.GOOGLE_CALENDAR_JURAJ_ID;
    delete process.env.GOOGLE_CALENDAR_STEFAN_ID;
    process.env.GOOGLE_CALENDAR_ID = 'legacy-calendar';
    assert.deepEqual(booking.getBarbers().map(b => b.name), ['Adam', 'Barberina', 'Martin Centko']);
    assert.equal(booking.getBarber('adam').calendarId, 'legacy-calendar');
    assert.throws(() => booking.getBarber('barberina'), { status: 503 });
    assert.throws(() => booking.getBarber('martin-centko'), { status: 503 });
    process.env.GOOGLE_CALENDAR_JURAJ_ID = 'juraj-calendar';
    assert.equal(booking.getBarber('barberina').calendarId, 'juraj-calendar');
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  }
});


test('services have screenshot prices and durations, and senior services require Adam tier', async () => {
  assert.equal(booking.getService('senior-long-hair').duration, 60);
  assert.equal(booking.getService('senior-long-hair').price, 20);
  assert.equal(booking.getService('barber-sides').duration, 30);
  assert.equal(booking.getService('barber-sides').price, 14);
  assert.equal(booking.getService('senior-hair-beard').price, 28);
  assert.equal(booking.getService('barber-hair-beard').price, 25);
  assert.equal(booking.getService('barber-beard').price, 12);
  assert.throws(() => booking.getService('unknown'));
  assert.equal((await reserve.POST(request({ ...payload, serviceId: 'senior-haircut' }))).status, 400);
  assert.equal((await reserve.POST(request({ ...payload, serviceId: undefined }))).status, 400);
});

test('availability uses full selected duration and closing time', async () => {
  const { serviceTimes } = require('../lib/services.ts');
  events = [{ start: { dateTime: nextDay.set({ hour: 9, minute: 45 }).toISO() }, end: { dateTime: nextDay.set({ hour: 10, minute: 15 }).toISO() } }];
  assert.ok(!(await calendar.busyTimes(booking.getBarber('one'), nextDay, 30)).includes('09:00'));
  assert.ok((await calendar.busyTimes(booking.getBarber('one'), nextDay, 60)).includes('09:00'));
  assert.ok(!serviceTimes(60).includes('20:15'));
  assert.ok(serviceTimes(30).includes('20:15'));
  assert.throws(() => booking.bookingStart(date, '20:15', 60));
  events = [];
});

test('booking ignores client-supplied price/duration and stores catalog service in calendar', async () => {
  const response = await reserve.POST(request({ ...payload, serviceId: 'barber-hair-beard', duration: 1, price: 0 }));
  assert.equal(response.status, 200);
  const event = inserts.at(-1).requestBody;
  assert.equal(DateTime.fromISO(event.end.dateTime).diff(DateTime.fromISO(event.start.dateTime), 'minutes').minutes, 60);
  assert.match(event.summary, /Pánsky strih \+ úprava brady/);
  assert.match(event.description, /25,00/);
});


test('overlapping requests of different durations are serialized within the server process', async () => {
  events = []; recordEvents = true;
  try {
    const results = await Promise.all([
      reserve.POST(request({ ...payload, serviceId: 'barber-hair-beard', time: '09:00' })),
      reserve.POST(request({ ...payload, serviceId: 'barber-beard', time: '09:45' })),
    ]);
    assert.deepEqual(results.map(result => result.status).sort(), [200, 409]);
    assert.equal(events.length, 1);
  } finally { events = []; recordEvents = false; }
});


const staffLogin = require('../app/api/staff/login/route.ts');
const staffReservations = require('../app/api/staff/reservations/route.ts');
const staffSession = require('../app/api/staff/session/route.ts');

test('staff login verifies password, returns private cookie and logout expires it', async () => {
  const wrong = await staffLogin.POST(request({ email: 'one@example.com', password: 'wrong-password' }));
  assert.equal(wrong.status, 401);
  assert.equal(wrong.headers.get('set-cookie'), null);
  const response = await staffLogin.POST(request({ email: 'ONE@example.com', password: 'test-password-123' }));
  assert.equal(response.status, 200);
  assert.match(response.headers.get('set-cookie'), /barbershop_staff=/);
  assert.match(response.headers.get('set-cookie'), /HttpOnly/);
  assert.match(response.headers.get('set-cookie'), /SameSite=lax/);
  const data = await response.json();
  assert.deepEqual(data.staff, { barberId: 'one', name: 'Prvý' });
  assert.ok(!JSON.stringify(data).includes(testHash));
  const logout = await staffSession.DELETE(request({}));
  assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
  assert.equal((await staffLogin.POST(request({ email: 'one@example.com', password: 'test-password-123' }, 'https://evil.example'))).status, 403);
});

test('private reservations require staff login and cannot select another barber via URL', async () => {
  cookieToken = undefined;
  const url = `http://localhost:3000/api/staff/reservations?date=${date}&barberId=two&calendarId=calendar-two`;
  assert.equal((await staffReservations.GET(new Request(url))).status, 401);
  cookieToken = auth.signStaffSession(auth.staffAccounts()[0]);
  events = [{ id: 'existing', summary: 'Staršia rezervácia', description: 'Klient: Starší klient\nOverený mobil: +421912345678', start: { dateTime: nextDay.set({ hour: 10 }).toISO() }, end: { dateTime: nextDay.set({ hour: 11 }).toISO() } }];
  const result = await staffReservations.GET(new Request(url));
  assert.equal(result.status, 200);
  assert.equal(pages.at(-1).calendarId, 'calendar-one');
  assert.match(result.headers.get('cache-control'), /no-store/);
  const data = await result.json();
  assert.equal(data.staff.barberId, 'one');
  assert.equal(data.reservations[0].phone, '+421912345678');
  assert.equal(data.reservations[0].customerName, 'Starší klient');
  cookieToken = auth.signStaffSession(auth.staffAccounts()[1]);
  await staffReservations.GET(new Request(url));
  assert.equal(pages.at(-1).calendarId, 'calendar-two');
  assert.equal((await staffReservations.GET(new Request('http://localhost:3000/api/staff/reservations?date=2030-02-31'))).status, 400);
  events = []; cookieToken = undefined;
});

test('staff login throttles repeated wrong passwords', async () => {
  for (let attempt = 0; attempt < 5; attempt++) {
    assert.equal((await staffLogin.POST(request({ email: 'two@example.com', password: 'wrong-password' }))).status, 401);
  }
  assert.equal((await staffLogin.POST(request({ email: 'two@example.com', password: 'wrong-password' }))).status, 429);
});


test('barber validation identifies invalid IDs and the actual configuration source', () => {
  const saved = { ...process.env };
  try {
    process.env.BARBERS_JSON = JSON.stringify([{ id: 'martin centko', name: 'Martin Centko', calendarId: '', tier: 'barber' }]);
    assert.throws(() => booking.getBarbers(), error => error.status === 503 && error.message.includes('Martin Centko') && error.message.includes('id') && error.message.includes('BARBERS_JSON') && error.message.includes('bez medzier'));
    process.env.BARBERS_JSON = JSON.stringify([{ id: 'martin-centko', name: 'Martin Centko', calendarId: '', tier: 'barber' }]);
    assert.equal(booking.getBarbers()[0].name, 'Martin Centko');
    delete process.env.BARBERS_JSON;
    delete process.env.GOOGLE_CALENDAR_ADAM_ID;
    process.env.GOOGLE_CALENDAR_ID = 'shared-test-calendar';
    process.env.GOOGLE_CALENDAR_JURAJ_ID = 'shared-test-calendar';
    assert.throws(() => booking.getBarbers(), error => error.message.includes('rovnaký kalendár') && error.message.includes('client/lib/booking.ts'));
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  }
});
