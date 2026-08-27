#!/usr/bin/env node
// SONDA CDP: bramka diagnostyczna dla kazdego zadania rysujacego cokolwiek w tej aplikacji.
// Steruje PRAWDZIWYM Chrome uzytkownika na 127.0.0.1:9222 zwyklym fetch + WebSocket, bez
// puppeteera/playwrighta (to bylby INNY Chromium, nie ten, w ktorym uzytkownik pracuje).
//
// Uzycie:
//   node scripts/sonda.mjs --url <adres> --skrypt <wyrazenie JS> [--zrzut <plik.png>]
//                           [--zrzut-wycinek <selektor CSS>] [--czekaj <ms>]
//
// Zachowanie:
//   - otwiera NOWA karte pod adresem --url (PUT /json/new);
//   - czeka, az window.__gotowe === true, najdluzej --czekaj ms (domyslnie 8000);
//   - wykonuje --skrypt przez Runtime.evaluate (awaitPromise, returnByValue);
//   - na stdout wypisuje WYLACZNIE JSON wyniku — bramki go parsuja, wiec zero ozdobnikow;
//   - przy --zrzut zapisuje Page.captureScreenshot do podanego pliku;
//   - przy --zrzut-wycinek przycina zrzut do prostokata podanego elementu. ⚠️ POTRZEBNE, ODKAD
//     dodatek jest KAFLEM w kolumnie tresci, a nie pelnym ekranem: `scripts/luminancja-png.mjs`
//     przelicza wspolrzedne maski na piksele zakladajac, ze PNG to sama kanwa. Bez przyciecia
//     kontrola mierzylaby prostokat tekstu obok kafla i cicho podawala bezsensowna liczbe;
//   - ZAWSZE zamyka karte na koniec (takze gdy skrypt rzucil) — inaczej po kilku bramkach
//     uzytkownik ma kilkanascie martwych kart w swojej przegladarce.
//
// Kody wyjscia: 0 sukces, 2 blad polaczenia z CDP, 3 przekroczony limit czasu, 4 wyjatek w skrypcie.

const BAZOWY_CDP = 'http://127.0.0.1:9222';

function sparsujArgumenty(argv) {
  const wynik = { url: undefined, skrypt: undefined, zrzut: undefined, wycinek: undefined, czekaj: 8000 };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--url') wynik.url = argv[++i];
    else if (arg === '--skrypt') wynik.skrypt = argv[++i];
    else if (arg === '--zrzut') wynik.zrzut = argv[++i];
    else if (arg === '--zrzut-wycinek') wynik.wycinek = argv[++i];
    else if (arg === '--czekaj') wynik.czekaj = Number(argv[++i]);
  }
  return wynik;
}

async function main() {
  const args = sparsujArgumenty(process.argv.slice(2));
  if (!args.url || !args.skrypt) {
    console.error('uzycie: node scripts/sonda.mjs --url <adres> --skrypt <wyrazenie JS> [--zrzut <plik.png>] [--czekaj <ms>]');
    process.exit(2);
    return;
  }

  let nowaKarta;
  try {
    const odp = await fetch(`${BAZOWY_CDP}/json/new?${encodeURIComponent(args.url)}`, { method: 'PUT' });
    if (!odp.ok) throw new Error(`CDP /json/new odpowiedzialo ${odp.status}`);
    nowaKarta = await odp.json();
  } catch (blad) {
    console.error(`blad polaczenia z CDP: ${blad.message ?? blad}`);
    process.exit(2);
    return;
  }

  const idKarty = nowaKarta.id;
  let kodWyjscia = 0;

  try {
    let ws;
    try {
      ws = new WebSocket(nowaKarta.webSocketDebuggerUrl);
      await new Promise((resolve, reject) => {
        ws.addEventListener('open', () => resolve());
        ws.addEventListener('error', (e) => reject(new Error(`polaczenie WebSocket nieudane: ${e.message ?? e}`)));
      });
    } catch (blad) {
      kodWyjscia = 2;
      throw blad;
    }

    let nastepneId = 0;
    const oczekujace = new Map();
    ws.addEventListener('message', (m) => {
      const dane = JSON.parse(m.data);
      if (dane.id !== undefined && oczekujace.has(dane.id)) {
        oczekujace.get(dane.id)(dane);
        oczekujace.delete(dane.id);
      }
    });
    const posli = (method, params) =>
      new Promise((resolve) => {
        const id = ++nastepneId;
        oczekujace.set(id, resolve);
        ws.send(JSON.stringify({ id, method, params }));
      });

    await posli('Runtime.enable', {});

    // czekanie az strona ustawi window.__gotowe = true
    const startCzekania = Date.now();
    let gotowe = false;
    while (Date.now() - startCzekania < args.czekaj) {
      const sprawdz = await posli('Runtime.evaluate', {
        expression: 'window.__gotowe === true',
        returnByValue: true,
      });
      if (sprawdz.result?.result?.value === true) {
        gotowe = true;
        break;
      }
      await new Promise((res) => setTimeout(res, 100));
    }
    if (!gotowe) {
      kodWyjscia = 3;
      throw new Error(`limit czasu (${args.czekaj} ms): window.__gotowe nigdy sie nie ustawilo`);
    }

    const odpowiedzEvaluate = await posli('Runtime.evaluate', {
      expression: args.skrypt,
      awaitPromise: true,
      returnByValue: true,
    });
    // ksztalt odpowiedzi CDP: { id, result: { result: <remote object>, exceptionDetails? } }
    const wynikSkryptu = odpowiedzEvaluate.result;

    if (wynikSkryptu?.exceptionDetails) {
      kodWyjscia = 4;
      const opis = wynikSkryptu.exceptionDetails.exception?.description
        ?? wynikSkryptu.exceptionDetails.text
        ?? JSON.stringify(wynikSkryptu.exceptionDetails);
      throw new Error(`wyjatek w skrypcie strony: ${opis}`);
    }

    // TYLKO ten jeden console.log — stdout ma niesc wylacznie JSON wyniku, zero ozdobnikow
    console.log(JSON.stringify(wynikSkryptu?.result?.value ?? null));

    if (args.zrzut) {
      const parametry = { format: 'png' };
      if (args.wycinek) {
        const prostokat = await posli('Runtime.evaluate', {
          expression: `(() => { const e = document.querySelector(${JSON.stringify(args.wycinek)});
            if (!e) return null; const r = e.getBoundingClientRect();
            return { x: r.left, y: r.top, width: r.width, height: r.height }; })()`,
          returnByValue: true,
        });
        const r = prostokat.result?.result?.value;
        // ⛔ BRAK ELEMENTU MUSI BYC SLYCHAC. Ciche zrobienie pelnego zrzutu daloby plik, ktory
        // wyglada poprawnie, a mierzy zupelnie co innego — dokladnie ten sam wzorzec, przed
        // ktorym broni sie `sredniaBarwa` w przyrzadzie strony.
        if (!r) {
          kodWyjscia = 4;
          throw new Error(`--zrzut-wycinek: selektor „${args.wycinek}" nie pasuje do zadnego elementu`);
        }
        parametry.clip = { x: r.x, y: r.y, width: r.width, height: r.height, scale: 1 };
        parametry.captureBeyondViewport = true;
      }
      const zrzut = await posli('Page.captureScreenshot', parametry);
      const { writeFileSync } = await import('node:fs');
      writeFileSync(args.zrzut, Buffer.from(zrzut.result.data, 'base64'));
    }

    ws.close();
  } catch (blad) {
    if (kodWyjscia === 0) kodWyjscia = 2;
    console.error(String(blad.message ?? blad));
  } finally {
    try {
      await fetch(`${BAZOWY_CDP}/json/close/${idKarty}`);
    } catch {
      // karta zostanie, ale probowalismy — nie ma juz czym o tym poinformowac uzytecznie
    }
  }

  process.exit(kodWyjscia);
}

main();
