"use client";

import { CATEGORIES, SERVICES, Service, TIER_NAMES, formatPrice } from "@/lib/services";

export function ServicePicker({ selectedId, disabled, onSelect }: { selectedId: string; disabled: boolean; onSelect: (service: Service) => void }) {
  return <section className="booking-section service-section">
    <h2><span className="step">1</span> Vyberte si službu</h2>
    <p className="muted">Zvoľte službu a úroveň kaderníka. Cenu uvidíte vopred.</p>
    <div className="service-categories">
      {CATEGORIES.map(category => <details key={category.id} className="service-category" open={category.id === "hair" ? true : undefined}>
        <summary>{category.name}<span className="accordion-icon" aria-hidden="true" /></summary>
        <div className="category-content">
          {(["senior", "barber"] as const).map(tier => {
            const services = SERVICES.filter(s => s.category === category.id && s.tier === tier);
            if (!services.length) return null;
            return <details key={tier} className="service-tier" open={tier === "senior" && category.id === "hair" ? true : undefined}>
              <summary>{TIER_NAMES[tier]}<span className="accordion-icon" aria-hidden="true" /></summary>
              <div className="service-grid">{services.map(service => <article key={service.id} className={`service-option ${selectedId === service.id ? "selected" : ""}`}>
                <h3>{service.name}</h3>
                <div className="service-meta"><span>Trvanie: <strong>{service.duration} min</strong></span><span>Cena: <strong>{formatPrice(service.price)}</strong></span></div>
                <details className="service-description"><summary>Zobraziť podrobnosti</summary><ul>{service.description.map(line => <li key={line}>{line}</li>)}</ul></details>
                <button type="button" disabled={disabled} aria-pressed={selectedId === service.id} onClick={() => onSelect(service)} className="select-service">{selectedId === service.id ? "✓ Vybraná služba" : "Vybrať službu"}<span aria-hidden="true">→</span></button>
              </article>)}</div>
            </details>;
          })}
        </div>
      </details>)}
    </div>
  </section>;
}
