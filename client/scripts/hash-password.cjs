// Interactive local helper; never put passwords in shell arguments or environment variables.
const { randomBytes, scryptSync } = require('node:crypto');
if (!process.stdin.isTTY) {
  console.error('Spustite príkaz v interaktívnom termináli.');
  process.exit(1);
}
process.stdout.write('Nové heslo (12 až 128 znakov, vstup je skrytý): ');
process.stdin.setRawMode(true);
process.stdin.setEncoding('utf8');
process.stdin.resume();
let password = '';
process.stdin.on('data', chunk => {
  for (const char of chunk) {
    if (char === '\u0003') { process.stdin.setRawMode(false); process.stdout.write('\n'); process.exit(1); }
    if (char === '\r' || char === '\n') {
      process.stdin.setRawMode(false); process.stdin.pause(); process.stdout.write('\n');
      if (password.length < 12 || password.length > 128) { console.error('Heslo musí mať 12 až 128 znakov.'); process.exit(1); }
      const salt = randomBytes(16);
      const hash = scryptSync(password, salt, 64, { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 });
      password = '';
      console.log(`scrypt$${salt.toString('hex')}$${hash.toString('hex')}`);
      process.exit(0);
    }
    if (char === '\u007f' || char === '\b') password = password.slice(0, -1);
    else if (char >= ' ') password += char;
  }
});
