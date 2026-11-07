"use client";

import "react-day-picker/dist/style.css";
import Link from "next/link";
import { DayPicker } from "react-day-picker";
import { useEffect, useState } from "react";
import { sk } from "date-fns/locale";
import { format } from "date-fns";
import { Banner } from "./components/Banner";
import { ZONE } from "@/lib/booking";

import { ServicePicker } from "./components/ServicePicker";
import { SERVICES, BarberTier, TIER_NAMES, formatPrice, serviceTimes } from "@/lib/services";

type Barber = { id: string; name: string; tier: BarberTier };

async function api(path: string, method = "GET", body?: object, signal?: AbortSignal) {
  const response = await fetch(path, {
    method, headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined, cache: "no-store", signal,
  });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.error || "Požiadavku sa nepodarilo dokončiť."), { status: response.status });
  return data;
}

export default function BookingPage() {
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [serviceId, setServiceId] = useState("");
  const service = SERVICES.find(s => s.id === serviceId);
  const times = service ? serviceTimes(service.duration) : [];
  const [barberId, setBarberId] = useState("");
  const [date, setDate] = useState<Date>();
  const [time, setTime] = useState("");
  const [booked, setBooked] = useState<string[]>([]);
  const [availability, setAvailability] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [reload, setReload] = useState(0);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const dayKey = date ? format(date, "yyyy-MM-dd") : "";
  const barber = barbers.find(b => b.id === barberId);

  useEffect(() => {
    const controller = new AbortController();
    api("/api/barbers", "GET", undefined, controller.signal).then(data => {
      setBarbers(data.barbers);

    }).catch(err => { if (!controller.signal.aborted) setError(err.message); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => { setNow(Date.now()); }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!dayKey || !barberId || !serviceId) return;
    const controller = new AbortController();
    setAvailability("loading");
    setBooked([]);
    setTime("");
    api("/api/google-calendar/check", "POST", { date: dayKey, barberId, serviceId }, controller.signal).then(data => {
      if (controller.signal.aborted) return;
      setBooked(data.bookedTimes);
      setAvailability("ready");
    }).catch(err => {
      if (!controller.signal.aborted) { setAvailability("error"); setError(err.message); }
    });
    return () => controller.abort();
  }, [dayKey, barberId, serviceId, reload]);

  useEffect(() => {
    if (service && barbers.length && !barbers.some(b => b.id === barberId && b.tier === service.tier)) {
      setBarberId(barbers.find(b => b.tier === service.tier)?.id || "");
    }
  }, [barbers, barberId, service]);

  const expired = (slot: string) => dayKey < today || (dayKey === today && slot <= new Intl.DateTimeFormat("sk-SK", { timeZone: ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now));

  async function confirm() {
    if (!service || !date || !time || !phone.trim() || busy || availability !== "ready" || expired(time)) return;
    setBusy(true); setError(""); setSuccess("");
    try {
      await api("/api/google-calendar", "POST", { barberId, serviceId, date: dayKey, time, name, phone });
      setSuccess(`Rezervácia potvrdená: ${service.name}, ${formatPrice(service.price)} – ${barber?.name}, ${format(date, "d. MMMM yyyy", { locale: sk })} o ${time}.`);
      setTime(""); setReload(value => value + 1);
    } catch (err) {
      const problem = err as Error & { status?: number };
      setError(problem.message);
      if (problem.status === 409) { setTime(""); setReload(value => value + 1); }
    } finally { setBusy(false); }
  }

  return (
    <main className="booking-shell">
      <div className="booking-card">
        <header className="booking-header"><Banner /><div className="header-links"><p>Váš kaderník. Váš termín.</p><Link href="/kadernik">Prihlásenie kaderníkov →</Link></div></header>
        {error && <div className="message error" role="alert">{error}</div>}
        {success && <div className="message success" role="status">{success}</div>}
        <ServicePicker selectedId={serviceId} disabled={busy} onSelect={selected => {
          setServiceId(selected.id);
          setTime(""); setAvailability("idle"); setError(""); setSuccess("");
          if (barber?.tier !== selected.tier) setBarberId(barbers.find(b => b.tier === selected.tier)?.id || "");
          if (selected.id === serviceId) setReload(value => value + 1);
        }} />
        <div className="booking-columns">
          <div>
            <section className="booking-section">
              <h2><span className="step">2</span> Vyberte kaderníka</h2>
              {!service ? <p className="muted">Najprv si vyberte službu.</p> : !barbers.some(b => b.tier === service.tier) ? <p className="muted">Pre túto službu zatiaľ nie je dostupný kaderník.</p> : (
                <div className="barber-list" role="group" aria-label="Kaderníci">
                  {barbers.filter(b => b.tier === service?.tier).map(b => <button key={b.id} type="button" aria-pressed={b.id === barberId} disabled={busy} className={`barber-option ${b.id === barberId ? "active" : ""}`} onClick={() => {
                    setBarberId(b.id); setTime(""); setAvailability("idle"); setError(""); setSuccess("");
                    if (b.id === barberId) setReload(value => value + 1);
                  }}><span className="avatar" aria-hidden="true">{b.name.charAt(0)}</span><span>{b.name}<small>{TIER_NAMES[b.tier]}</small></span><span aria-hidden="true">{b.id === barberId ? "✓" : "+"}</span></button>)}
                </div>
              )}
            </section>
            <section className="booking-section">
              <h2><span className="step">3</span> Dátum a čas</h2>
              <p className="muted">Termíny pre {barber?.name || "vybraného kaderníka"} · slovenský čas</p>
              <DayPicker mode="single" locale={sk} selected={date} onSelect={value => {
                setDate(value); setTime(""); setAvailability("idle"); setError(""); setSuccess("");
              }} disabled={day => !service || !barberId || busy || format(day, "yyyy-MM-dd") < today || day.getDay() === 0} weekStartsOn={1} className="booking-calendar" />
              {date && <div className="slots-area" aria-busy={availability === "loading"}>
                <h3>Časy na {format(date, "d. MMMM", { locale: sk })}</h3>
                {availability === "loading" && <p role="status" className="muted">Overujem voľné termíny…</p>}
                {availability === "error" && <button type="button" className="secondary" onClick={() => { setError(""); setReload(value => value + 1); }}>Skúsiť načítať termíny znova</button>}
                {availability === "ready" && <>
                  <div className="time-grid">{times.map(slot => <button type="button" key={slot} disabled={busy || booked.includes(slot) || expired(slot)} aria-pressed={time === slot} onClick={() => setTime(slot)} className={`time-option ${time === slot ? "active" : ""}`}>{slot}</button>)}</div>
                  {times.every(slot => booked.includes(slot) || expired(slot)) && <p className="muted">Na tento deň už nie sú voľné termíny. Vyberte iný dátum alebo kaderníka.</p>}
                </>}
              </div>}
            </section>
          </div>
          <section className="booking-section checkout">
            <h2><span className="step">4</span> Potvrdenie rezervácie</h2>
            <p className="muted">Stačí zadať meno a telefón. Prihlásenie ani SMS kód nepotrebujete.</p>
            <div className="booking-summary"><h3>Vaša rezervácia</h3><dl><div><dt>Služba</dt><dd>{service?.name || "Vyberte službu"}</dd></div><div><dt>Kaderník</dt><dd>{barber?.name || "—"}</dd></div><div><dt>Dátum</dt><dd>{date ? format(date, "d. MMM yyyy", { locale: sk }) : "Vyberte dátum"}</dd></div><div><dt>Čas</dt><dd>{time || "Vyberte čas"}</dd></div><div><dt>Trvanie</dt><dd>{service ? `${service.duration} minút` : "—"}</dd></div><div><dt>Cena</dt><dd>{service ? formatPrice(service.price) : "—"}</dd></div></dl></div>
            <form className="auth-form" onSubmit={event => { event.preventDefault(); void confirm(); }}>
              <label htmlFor="customer-name">Vaše celé meno</label>
              <input id="customer-name" autoComplete="name" value={name} onChange={event => setName(event.target.value)} minLength={2} maxLength={100} placeholder="Meno a priezvisko" required disabled={busy} />
              <label htmlFor="customer-phone">Telefónne číslo</label>
              <input id="customer-phone" type="tel" autoComplete="tel" value={phone} onChange={event => setPhone(event.target.value)} placeholder="+421 9xx xxx xxx" maxLength={30} required disabled={busy} />
              <p className="fine-print">Telefón použije kaderník, ak vás potrebuje kontaktovať ohľadom termínu.</p>
              <button className="primary" disabled={busy || !service || !phone.trim() || !time || expired(time) || name.trim().length < 2 || availability !== "ready"}>{busy ? "Spracúvam…" : "Potvrdiť rezerváciu"}</button>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
