// Local interactive account setup. No passwords are sent or stored in plaintext.
const fs = require("node:fs");
const path = require("node:path");
const { randomBytes, scryptSync } = require("node:crypto");
const { createInterface } = require("node:readline/promises");
const { loadEnvConfig } = require("@next/env");

async function main() {
  if (!process.stdin.isTTY)
    throw new Error("Spustite príkaz v interaktívnom termináli.");
  const directory = path.resolve(__dirname, "..");
  loadEnvConfig(directory, true);
  const barbers = process.env.BARBERS_JSON
    ? JSON.parse(process.env.BARBERS_JSON)
    : [
        { id: "adam", name: "Adam" },
        { id: "barberina", name: "Barberina" },
        { id: "martin-centko", name: "Martin Centko" },
      ];
  const accounts = JSON.parse(process.env.STAFF_ACCOUNTS_JSON || "[]");
  if (!Array.isArray(accounts))
    throw new Error("Neplatné STAFF_ACCOUNTS_JSON.");
  const prompt = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  let barberId, email;
  try {
    console.log(
      "Kaderníci: " + barbers.map((b) => `${b.id} (${b.name})`).join(", "),
    );
    barberId = (await prompt.question("ID kaderníka: ")).trim();
    if (!barbers.some((b) => b.id === barberId))
      throw new Error("Neplatné ID kaderníka.");
    email = (await prompt.question("Prihlasovací e-mail: "))
      .trim()
      .toLowerCase();
    if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email))
      throw new Error("Neplatný e-mail.");
    if (
      accounts.some(
        (a) => a.email.toLowerCase() === email && a.barberId !== barberId,
      )
    )
      throw new Error("Tento e-mail už používa iný kaderník.");
  } finally {
    prompt.close();
  }
  process.stdout.write("Nové heslo (12 až 128 znakov, vstup je skrytý): ");
  const password = await new Promise((resolve, reject) => {
    let value = "";
    process.stdin.setRawMode(true);
    process.stdin.setEncoding("utf8");
    process.stdin.resume();
    function finish(error) {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener("data", onData);
      process.stdout.write("\n");
      if (error) reject(error);
      else resolve(value);
    }
    function onData(chunk) {
      for (const char of chunk) {
        if (char === "\u0003") {
          finish(new Error("Nastavenie zrušené."));
          return;
        }
        if (char === "\r" || char === "\n") {
          finish();
          return;
        }
        if (char === "\u007f" || char === "\b") value = value.slice(0, -1);
        else if (char >= " ") value += char;
      }
    }
    process.stdin.on("data", onData);
  });
  if (password.length < 12 || password.length > 128)
    throw new Error("Heslo musí mať 12 až 128 znakov. Nič sa neuložilo.");
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64, {
    N: 131072,
    r: 8,
    p: 1,
    maxmem: 256 * 1024 * 1024,
  });
  const passwordHash = `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
  const updated = accounts.filter((a) => a.barberId !== barberId);
  updated.push({ barberId, email, passwordHash });
  const envPath = path.join(directory, ".env.local");
  let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
  function set(key, value) {
    const expression = new RegExp(`^${key}=.*$`, "gm");
    const line = `${key}=${value}`;
    content = expression.test(content)
      ? content.replace(expression, () => line)
      : `${content.trimEnd()}\n${line}\n`;
  }
  set("STAFF_ACCOUNTS_JSON", JSON.stringify(updated));
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)
    set("SESSION_SECRET", randomBytes(32).toString("hex"));
  fs.writeFileSync(envPath, content, { mode: 0o600 });
  console.log(
    `Účet pre ${barbers.find((b) => b.id === barberId).name} bol uložený do client/.env.local. Reštartujte server a otvorte /kadernik.`,
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
