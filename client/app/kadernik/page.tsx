"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ZONE } from "@/lib/booking";
import { formatPrice } from "@/lib/services";

type Staff = { barberId: string; name: string };
type Reservation = { id: string; title: string; start: string; end: string; allDay: boolean; customerName: string; phone: string; serviceName: string; price: number | null };

async function api(path: string, method = "GET", body?: object, signal?: AbortSignal) {
  const response = await fetch(path, { method, body: body ? JSON.stringify(body) : undefined, headers: body ? { "Content-Type": "application/json" } : undefined, cache: "no-store", signal });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.error || "Požiadavku sa nepodarilo dokončiť."), { status: response.status });
  return data;
}
function clock(value: string) {
  return new Intl.DateTimeFormat("sk-SK", { timeZone: ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(value));
}
function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export default function StaffPage() {
  const [staff, setStaff] = useState<Staff | null>(null);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [date, setDate] = useState(today);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loadedDate, setLoadedDate] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    api("/api/staff/session", "GET", undefined, controller.signal).then(data => { if (!controller.signal.aborted) setStaff(data.staff); })
      .catch(err => { if (!controller.signal.aborted) setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setChecking(false); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!staff || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    const controller = new AbortController();
    setLoading(true); setError(""); setReservations([]); setLoadedDate("");
    api(`/api/staff/reservations?date=${encodeURIComponent(date)}`, "GET", undefined, controller.signal).then(data => {
      if (!controller.signal.aborted) { setReservations(data.reservations); setLoadedDate(data.date); }
    }).catch(err => {
      if (!controller.signal.aborted) { setError(err.message); if (err.status === 401) setStaff(null); }
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [staff, date, reload]);

  async function login(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const data = await api("/api/staff/login", "POST", { email, password });
      setPassword(""); setStaff(data.staff);
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }
  async function logout() {
    setBusy(true); setError("");
    try {
      await api("/api/staff/session", "DELETE");
      setStaff(null); setReservations([]); setLoadedDate(""); setPassword("");
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }
  function changeDay(amount: number) {
    const day = new Date(`${date}T12:00:00Z`);
    if (Number.isNaN(day.getTime())) { setDate(today()); return; }
    day.setUTCDate(day.getUTCDate() + amount);
    setDate(day.toISOString().slice(0, 10));
  }

  return <main className="booking-shell">
    <div className={`booking-card staff-card ${!staff ? "staff-login-card" : ""}`}>
      <header className="booking-header"><div className="staff-title"><div><p className="staff-eyebrow">BARBERSHOP · PRE KADERNÍKOV</p><h1>{staff ? `Vitaj, ${staff.name}` : "Vaše rezervácie na jednom mieste"}</h1></div>{staff && <button type="button" className="staff-logout" disabled={busy} onClick={logout}>Odhlásiť</button>}</div><div className="header-links"><p>{staff ? "Váš denný prehľad termínov" : "Prihláste sa e-mailom a heslom."}</p><Link href="/">← Späť na rezerváciu</Link></div></header>
      {error && <div className="message error" role="alert">{error}</div>}
      {checking ? <p className="booking-section" role="status">Overujem prihlásenie…</p> : !staff ? <section className="booking-section">
        <h2>Prihlásenie kaderníka</h2><p className="muted">Každý kaderník má vlastný účet a vidí iba svoj kalendár.</p>
        <form className="auth-form" onSubmit={login}>
          <label htmlFor="staff-email">E-mail</label><input id="staff-email" type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} maxLength={254} required disabled={busy} />
          <label htmlFor="staff-password">Heslo</label><input id="staff-password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} maxLength={128} required disabled={busy} />
          <button className="primary" disabled={busy}>{busy ? "Prihlasujem…" : "Prihlásiť sa"}</button>
        </form><p className="fine-print staff-help">Prístup alebo nové heslo vám nastaví správca salónu.</p>
      </section> : <section className="booking-section">
        <div className="staff-toolbar"><div><h2>Moje termíny</h2><p className="muted">Slovenský čas · synchronizované s Google Kalendárom</p></div><button className="secondary" type="button" disabled={loading} onClick={() => setReload(value => value + 1)}>Obnoviť</button></div>
        <div className="staff-date"><button className="secondary" type="button" aria-label="Predchádzajúci deň" onClick={() => changeDay(-1)}>←</button><div><label htmlFor="staff-date">Dátum</label><input id="staff-date" type="date" value={date} onChange={event => setDate(event.target.value)} required /></div><button className="secondary" type="button" aria-label="Nasledujúci deň" onClick={() => changeDay(1)}>→</button><button className="text-button" type="button" onClick={() => setDate(today())}>Dnes</button></div>
        {loading ? <p className="staff-empty" role="status">Načítavam termíny…</p> : loadedDate === date && <>
          <p className="muted" role="status">Počet termínov: {reservations.length}</p>
          {!reservations.length ? <div className="staff-empty">Na tento deň nemáte žiadne rezervácie.</div> : <div className="reservation-list">{reservations.map((item, index) => <article key={item.id || index} className="reservation-card">
            <div className="reservation-time">{item.allDay ? "Celý deň" : `${clock(item.start)} – ${clock(item.end)}`}</div>
            <div className="reservation-details"><h3>{item.customerName || item.title}</h3><p>{item.serviceName || (!item.customerName ? "Udalosť v kalendári" : item.title)}</p>{item.phone && <a href={`tel:${item.phone.replace(/[^+0-9]/g, "")}`}>{item.phone}</a>}</div>
            {item.price !== null && <strong className="reservation-price">{formatPrice(item.price)}</strong>}
          </article>)}</div>}
        </>}
      </section>}
    </div>
  </main>;
}
