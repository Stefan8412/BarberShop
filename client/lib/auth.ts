import { createHash, createHmac, scrypt, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { AppError, getBarbers } from "./booking";

export const SESSION_COOKIE = "barbershop_staff";
export const SESSION_SECONDS = 60 * 60 * 12;
type StaffAccount = { barberId: string; email: string; passwordHash: string };
const HASH_PATTERN = /^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/;

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new AppError("Prihlásenie kaderníkov ešte nie je nastavené.", 503);
  return value;
}

export function staffAccounts(): StaffAccount[] {
  let accounts: unknown;
  try { accounts = JSON.parse(process.env.STAFF_ACCOUNTS_JSON || "[]"); }
  catch { throw new AppError("Konfigurácia účtov kaderníkov nie je správna.", 503); }
  const ids = getBarbers().map(b => b.id);
  if (!Array.isArray(accounts) || accounts.length === 0 || accounts.some(a =>
    !a || typeof a.barberId !== "string" || !ids.includes(a.barberId) ||
    typeof a.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email) ||
    typeof a.passwordHash !== "string" || !HASH_PATTERN.test(a.passwordHash)) ||
    new Set(accounts.map(a => a.barberId)).size !== accounts.length ||
    new Set(accounts.map(a => a.email.toLowerCase())).size !== accounts.length) {
    throw new AppError("Nastavte účty kaderníkov v STAFF_ACCOUNTS_JSON.", 503);
  }
  return accounts.map(a => ({ ...a, email: a.email.toLowerCase() }));
}

function fingerprint(account: StaffAccount) {
  return createHash("sha256").update(`${account.email}:${account.passwordHash}`).digest("hex");
}

export function signStaffSession(account: StaffAccount, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ barberId: account.barberId, version: fingerprint(account), exp: Math.floor(now / 1000) + SESSION_SECONDS })).toString("base64url");
  return `${payload}.${createHmac("sha256", secret()).update(payload).digest("base64url")}`;
}

export function readStaffSession(token: string | undefined, now = Date.now()): StaffAccount | null {
  if (!token || token.length > 1024) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const expected = createHmac("sha256", secret()).update(parts[0]).digest("base64url");
  const actual = Buffer.from(parts[1]);
  if (actual.length !== expected.length || !timingSafeEqual(actual, Buffer.from(expected))) return null;
  try {
    const value = JSON.parse(Buffer.from(parts[0], "base64url").toString());
    if (!Number.isSafeInteger(value.exp) || value.exp <= Math.floor(now / 1000)) return null;
    return staffAccounts().find(a => a.barberId === value.barberId && fingerprint(a) === value.version) || null;
  } catch (error) {
    if (error instanceof AppError) throw error;
    return null;
  }
}

export async function currentStaff() {
  return readStaffSession((await cookies()).get(SESSION_COOKIE)?.value);
}
export function cookieOptions() {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: SESSION_SECONDS };
}
export function publicStaff(account: StaffAccount) {
  return { barberId: account.barberId, name: getBarbers().find(b => b.id === account.barberId)!.name };
}

// Local process limits; a shared host/WAF limit is required for multi-instance hosting.
const attempts = new Map<string, { count: number; expires: number }>();
let activeChecks = 0;
export async function authenticateStaff(email: unknown, password: unknown) {
  secret();
  if (typeof email !== "string" || typeof password !== "string" || email.length > 254 || password.length > 128 || !password) {
    throw new AppError("Nesprávny e-mail alebo heslo.", 401);
  }
  const accounts = staffAccounts();
  const account = accounts.find(a => a.email === email.trim().toLowerCase());
  const key = account?.barberId || "unknown-account";
  const now = Date.now();
  for (const [id, entry] of attempts) if (entry.expires <= now) attempts.delete(id);
  const limit = attempts.get(key) || { count: 0, expires: now + 15 * 60 * 1000 };
  if (limit.count >= 5 || activeChecks >= 2) throw new AppError("Príliš veľa pokusov. Skúste to neskôr.", 429);
  limit.count++; attempts.set(key, limit);
  const [, salt, hash] = (account?.passwordHash || `scrypt$${"0".repeat(32)}$${"0".repeat(128)}`).split("$");
  activeChecks++;
  try {
    const derived = await new Promise<Buffer>((resolve, reject) => {
      scrypt(password, Buffer.from(salt, "hex"), 64, { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 }, (error, result) => error ? reject(error) : resolve(result));
    });
    if (!account || !timingSafeEqual(derived, Buffer.from(hash, "hex"))) throw new AppError("Nesprávny e-mail alebo heslo.", 401);
    attempts.delete(key);
    return account;
  } finally { activeChecks--; }
}
