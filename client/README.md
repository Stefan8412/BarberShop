# BarberShop

Rezervácie pre jeden salón s viacerými kaderníkmi. Každý kaderník má vlastný Google Kalendár. Zákazník rezervuje bez prihlásenia, zadaním mena a telefónu. Kaderníci sa prihlasujú e-mailom a heslom na `/kadernik` a vidia iba svoj kalendár. Aplikácia neposiela SMS a nepotrebuje Twilio.

## Spustenie

V priečinku `client`:

```sh
npm install
cp .env.example .env.local
npm run dev
```

Ak `.env.local` už existuje, doplňte doň nové premenné z príkladu, neprepisujte existujúce Google prístupy. Po zmene prostredia reštartujte server.

## Kaderníci a kalendáre

1. Pre každého kaderníka vytvorte samostatný Google Kalendár a zdieľajte ho so servisným účtom (`GOOGLE_CLIENT_EMAIL`) s právom upravovať udalosti. V Google Cloud zapnite Calendar API.
2. Predvolený tím tvorí **Adam, Juraj a Štefan**. Doplňte `GOOGLE_CALENDAR_ADAM_ID`, `GOOGLE_CALENDAR_JURAJ_ID` a `GOOGLE_CALENDAR_STEFAN_ID`. Každý musí mať iný kalendár. Kaderník bez kalendára sa zobrazí vo výbere, ale dostupnosť aj rezervácie vrátia zrozumiteľnú chybu. Celý tím možno prepísať cez `BARBERS_JSON` so stabilnými verejnými `id`, menami a `calendarId`. Administrácia kaderníkov nie je súčasťou aplikácie.
3. Zachovajte `GOOGLE_CLIENT_EMAIL` a `GOOGLE_PRIVATE_KEY`. Staré `GOOGLE_CALENDAR_ID` sa používa pre Adama, ak chýba `GOOGLE_CALENDAR_ADAM_ID` a `BARBERS_JSON`.

Dostupnosť sa počíta pre Europe/Bratislava, pondelok až sobota, so začiatkami každých 45 minút od 09:00. Trvanie určuje vybraná služba (30, 45 alebo 60 minút); zobrazené sú iba začiatky, pri ktorých služba skončí do 21:00. Blokujú sa aj čiastočne sa prekrývajúce a celodenné udalosti. Transparentné a zrušené udalosti neblokujú termíny. Klient nedostáva údaje zákazníkov ani ID kalendárov.

Pred vytvorením rezervácie server znovu kontroluje dostupnosť. Deterministické Google event ID obmedzuje súbežné rezervovanie rovnakého slotu cez aplikáciu. Google Kalendár neposkytuje transakciu medzi čítaním a vložením udalosti: požiadavky na rovnaký kalendár sa v jednom Node procese spracúvajú postupne. Súbežné ručné vloženie udalosti alebo rezervácie s rôznymi začiatkami na viacerých serverových procesoch môžu stále vytvoriť prekryv. Pri zrušení rezervácie môže Google dočasne ponechať tombstone pôvodného ID a brániť okamžitej opätovnej rezervácii toho istého slotu. Pre plne transakčné rezervácie a správu rušenia je potrebná databáza s unikátnym slotom a synchronizáciou do kalendára.

## Služby a ceny

Katalóg je v `lib/services.ts`. Adam je **Senior barber**, Juraj a Štefan sú **Barber**. Pri vlastnom `BARBERS_JSON` možno úroveň nastaviť cez `"tier":"senior"` alebo `"tier":"barber"` (predvolene je iba ID `adam` senior). Výber služby filtruje kaderníkov, zmena služby vymaže vybraný čas. Server nezávisle kontroluje službu aj úroveň kaderníka a preberá cenu a trvanie z katalógu.

| Služba | Senior barber | Barber | Trvanie |
| --- | --- | --- | --- |
| Pánsky strih | 20 € | 18 € | 45 min |
| Dlhé vlasy – nožnicový strih | 20 € | — | 60 min |
| Iba boky bez umytia | 18 € | 14 € | 30 min |
| Pánsky strih + úprava brady | 28 € | 25 € | 60 min |
| Úprava brady | — | 12 € | 30 min |

Cena a služba sa zobrazujú v súhrne aj v Google udalosti. Rezervácie a kontrola dostupnosti teraz vyžadujú `serviceId`; starí API klienti ho musia doplniť. Recenzie a Instagram z referenčných obrázkov nie sú pridané, pretože neboli dodané odkazy ani vlastné hodnotenia salónu.

## Prihlásenie kaderníkov

Na hlavnej stránke je odkaz **Prihlásenie kaderníkov** (`/kadernik`). Po prihlásení kaderník vyberie dátum a vidí svoje termíny, službu, cenu a kontakt zákazníka. Tlačidlo Obnoviť načíta aktuálny stav z Google Kalendára. Zobrazujú sa aj staršie rezervácie a ostatné udalosti v jeho kalendári. Úpravy a rušenie sa zatiaľ robia v Google Kalendári.

### Vytvorenie účtov

Najjednoduchšie spustite v koreňovom priečinku **`npm run staff:setup`**. Sprievodca sa spýta na ID kaderníka, jeho e-mail a nové heslo (skrytý vstup). Účet s hashom uloží do `client/.env.local`, existujúce Google nastavenia zachová a v prípade potreby vytvorí `SESSION_SECRET`. Spustite ho postupne pre `adam`, `juraj` a `stefan`, potom reštartujte server. Rovnaký príkaz slúži aj na zmenu hesla účtu. Existujúci účet zvoleného kaderníka sa nahradí; ostatné sa zachovajú.

Alternatívne ručné nastavenie:

1. Pre každého kaderníka spustite v koreňovom priečinku `npm run staff:password`. Zadajte jedinečné heslo s 12 až 128 znakmi; vstup je skrytý. Príkaz vypíše iba hash s náhodnou soľou, nie heslo. Heslá nedávajte do shell príkazov ani do chatu.
2. Do `client/.env.local` doplňte `STAFF_ACCOUNTS_JSON` s reálnymi e-mailmi a vygenerovanými hashmi. Záznam obsahuje `barberId` (`adam`, `juraj`, `stefan`), `email` a `passwordHash`. Môžete začať jedným účtom a ostatné doplniť neskôr. Príklad štruktúry je v `.env.example`.
3. Nastavte `SESSION_SECRET` vygenerovaný cez `openssl rand -hex 32` (aspoň 32 znakov). Rovnaká hodnota musí byť na všetkých inštanciách.
4. `APP_ORIGIN` nastavte na presnú adresu aplikácie bez koncového lomítka, lokálne `http://localhost:3000`. V produkcii používajte HTTPS. Reštartujte server.

Neexistujú predvolené heslá ani verejná registrácia. Heslá sú uložené iba ako scrypt hashe (N=131072, r=8, p=1) s náhodnou soľou. Relácia kaderníka trvá 12 hodín v podpísanej HttpOnly cookie, v produkcii aj Secure. Server odvodzuje kalendár z účtu; parameter kaderníka od klienta nemôže rozšíriť prístup. Odpovede s rezerváciami sa neukladajú do cache.

Zmenu alebo reset hesla vykoná správca vygenerovaním nového hashu, jeho uložením do konfigurácie a reštartom servera. Zmena e-mailu/hesla alebo odstránenie účtu zneplatní jeho doterajšie relácie. Odhlásenie odstráni cookie z aktuálneho prehliadača.

Po 5 pokusoch za 15 minút je prihlásenie účtu dočasne obmedzené. Limity a serializácia rezervácií sú v pamäti jedného Node procesu: pre viac inštancií a verejnú prevádzku nastavte aj zdieľaný limit požiadaviek na hostingu/WAF pre prihlasovanie a rezervácie. Bez SMS sa overuje formát telefónu, nie jeho vlastníctvo.

### Odstránenie SMS

Zákazník už nepotrebuje session ani `SESSION_SECRET` na vytvorenie rezervácie. Jeho meno a telefón sa overujú na serveri. Staré SMS endpointy vracajú HTTP 410 a Twilio nikdy nevolajú. Premenné `TWILIO_*` môžete odstrániť z prostredia; aplikácia ich nepoužíva. Existujúce termíny ostávajú v kalendároch. Samotný Twilio účet ani jeho prípadné platené doplnky sa tým automaticky nerušia.

## Overenie

```sh
npm test
npx tsc --noEmit
npm run build
```

Automatické testy používajú simulované kalendárové odpovede a testovacie účty, neposielajú SMS ani nevytvárajú skutočné rezervácie. Po doplnení prístupov overte živý scenár: zákazník zadá meno a telefón → rezervuje termín → prihlásený kaderník vidí termín na `/kadernik` aj vo svojom Google Kalendári.
