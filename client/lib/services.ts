export type BarberTier = "senior" | "barber";
export type ServiceCategory = "hair" | "hair-beard" | "beard";
export type Service = {
  id: string;
  name: string;
  category: ServiceCategory;
  tier: BarberTier;
  duration: number;
  price: number;
  description: string[];
};

export const CATEGORIES: { id: ServiceCategory; name: string }[] = [
  { id: "hair", name: "Vlasy" },
  { id: "hair-beard", name: "Vlasy + brada" },
  { id: "beard", name: "Brada" },
];
export const TIER_NAMES: Record<BarberTier, string> = {
  senior: "Senior barber",
  barber: "Barber",
};
export const SERVICES: Service[] = [
  {
    id: "senior-haircut",
    name: "Pánsky strih",
    category: "hair",
    tier: "senior",
    duration: 45,
    price: 20,
    description: ["Konzultácia", "Moderný pánsky strih"],
  },
  {
    id: "senior-long-hair",
    name: "Dlhé vlasy – nožnicový strih",
    category: "hair",
    tier: "senior",
    duration: 60,
    price: 20,
    description: ["Konzultácia", "Strihanie dlhých vlasov nožnicami"],
  },
  {
    id: "senior-sides",
    name: "Iba boky – strih strojčekom bez umytia",
    category: "hair",
    tier: "senior",
    duration: 30,
    price: 18,
    description: ["Konzultácia", "Strihanie iba bokov strojčekom, bez umytia"],
  },
  {
    id: "barber-haircut",
    name: "Pánsky strih",
    category: "hair",
    tier: "barber",
    duration: 45,
    price: 18,
    description: ["Konzultácia", "Moderný pánsky strih"],
  },
  {
    id: "barber-sides",
    name: "Iba boky – strih strojčekom bez umytia",
    category: "hair",
    tier: "barber",
    duration: 30,
    price: 14,
    description: ["Konzultácia", "Strihanie iba bokov strojčekom, bez umytia"],
  },
  {
    id: "senior-hair-beard",
    name: "Pánsky strih + úprava brady",
    category: "hair-beard",
    tier: "senior",
    duration: 60,
    price: 28,
    description: ["Konzultácia", "Moderný pánsky strih", "Úprava brady"],
  },
  {
    id: "barber-hair-beard",
    name: "Pánsky strih + úprava brady",
    category: "hair-beard",
    tier: "barber",
    duration: 60,
    price: 25,
    description: ["Konzultácia", "Moderný pánsky strih", "Úprava brady"],
  },
  {
    id: "barber-beard",
    name: "Úprava brady",
    category: "beard",
    tier: "barber",
    duration: 30,
    price: 12,
    description: ["Konzultácia", "Úprava brady"],
  },
  {
    id: "senior-beard",
    name: "Úprava brady",
    category: "beard",
    tier: "senior",
    duration: 30,
    price: 15,
    description: ["Konzultácia", "Úprava brady"],
  },
];
export function formatPrice(price: number) {
  return new Intl.NumberFormat("sk-SK", {
    style: "currency",
    currency: "EUR",
  }).format(price);
}
// Preserve the existing 45-minute start grid and 21:00 closing time.
export function serviceTimes(duration: number) {
  return Array.from({ length: 16 }, (_, i) => 540 + i * 45)
    .filter((minutes) => minutes + duration <= 21 * 60)
    .map(
      (minutes) =>
        `${Math.floor(minutes / 60)
          .toString()
          .padStart(2, "0")}:${(minutes % 60).toString().padStart(2, "0")}`,
    );
}
