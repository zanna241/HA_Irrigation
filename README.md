# 💧 IrrigaHA — Regia irrigazione a mappa per Home Assistant

App web (single-page, nessun backend da installare) per progettare graficamente il proprio
prato/aiuole, posizionare irrigatori e sensori, e comandare l'irrigazione — manuale, a timer o
automatica in base al meteo — tramite le entità di **Home Assistant** (relè smart per valvole di
zona e pompa, centraline meteo Tuya-compatibili o simili già integrate in HA).

- 🗺️ Editor a mappa: aree prato/aiuola, irrigatori con gittata/arco/rotazione, sensori
- 🚿 Zone e pompa collegate a relè smart HA, con calcolo portata stimata per zona
- 🎛️ Controllo manuale, ⏱️ timer, 🌦️ modalità automatica con regole meteo/umidità suolo
- 📘 Database irrigatori (Rain Bird, Hunter, Gardena, Irritrol, goccia) modificabile
- 🧊 Anteprima 3D animata dei getti quando una zona è in funzione
- 📲 Installabile come app (PWA) e/o come pannello nella sidebar di Home Assistant

Tutto lo stato (mappa, zone, timer, credenziali HA) resta **solo nel browser del dispositivo**
(`localStorage`): non c'è alcun server esterno coinvolto oltre alla tua istanza Home Assistant.

---

## 1. Metti il codice su GitHub

1. Crea un nuovo repository su GitHub (es. `irrigaha`).
2. Carica tutti i file di questa cartella così come sono (struttura piatta, `index.html` in root).
3. Committa sul branch `main`.

## 2. Installazione — scegli una o più modalità

### A) Add-on per Home Assistant OS / Supervised — consigliata se disponibile

Il modo più integrato: compare nell'Add-on Store, si avvia come container gestito da HA e, con
Ingress attivo, appare direttamente nella sidebar senza dover configurare `panel_iframe` o CORS a
mano (basta usare come "URL base" nell'app lo stesso indirizzo con cui apri normalmente HA).

1. **Impostazioni → Add-on, backup e supervisor → Add-on Store**.
2. Menu **⋮ → Repository**, incolla l'URL di questo repository GitHub, conferma.
3. Cerca **"IrrigaHA"**, apri la scheda, **Installa**, poi **Avvia**.
4. Attiva **"Mostra nella sidebar"**.
5. Apri "Irrigazione" dalla sidebar e vai su **Impostazioni** per collegare Home Assistant (URL +
   Long-Lived Access Token — l'Ingress non concede un token automaticamente, va comunque creato).

Disponibile solo su **Home Assistant OS** o installazioni **Supervised** (l'Add-on Store non
esiste su Core/Container senza Supervisor: in quel caso usa la modalità B o C qui sotto).
Dettagli aggiuntivi nella documentazione dell'add-on: [`irrigaha/DOCS.md`](irrigaha/DOCS.md).

### B) App installabile (PWA) via GitHub Pages — per telefono/tablet/PC, qualunque installazione HA

1. Nel repository su GitHub vai su **Settings → Pages**.
2. Se non parte da sola, abilita la pubblicazione: **Source → GitHub Actions** (è già incluso il
   workflow `.github/workflows/pages.yml` che pubblica automaticamente ad ogni push su `main`).
3. Dopo il primo deploy, GitHub mostra l'URL pubblico (tipo `https://TUO-USER.github.io/irrigaha/`).
4. Apri quell'URL da Chrome/Edge/Safari sul dispositivo che userai:
   - **Android/desktop Chrome**: comparirà l'icona "Installa app" nella barra indirizzi (o il
     pulsante "⬇️ Installa app" in alto nella pagina) — tocca/clicca per installarla come app.
   - **iPhone/iPad (Safari)**: menu Condividi → "Aggiungi a Home".
5. Da quel momento si apre come un'app a sé stante, con icona propria.

> Nota: GitHub Pages è pubblico. L'app in sé non contiene segreti (il token HA lo inserisci tu a
> runtime e resta solo nel tuo browser), ma se non vuoi che il codice sorgente sia visibile
> pubblicamente crea il repository come **privato** e pubblica comunque con Pages (disponibile
> anche sui piani GitHub Free per i repo privati) oppure usa la modalità B qui sotto.

### C) Pannello nella sidebar di Home Assistant senza add-on (Core/Container, nessun hosting esterno)

1. Copia `index.html`, `manifest.json`, `sw.js` e la cartella `icons/` dentro
   `config/www/irrigaha/` della tua installazione HA (crea le cartelle se non esistono).
2. Aggiungi in `configuration.yaml`:

   ```yaml
   panel_iframe:
     irrigaha:
       title: Irrigazione
       icon: mdi:sprinkler-variant
       url: /local/irrigaha/index.html
       require_admin: false
   ```

3. Riavvia Home Assistant. Comparirà **"Irrigazione"** nella sidebar, con l'app caricata
   direttamente dentro l'interfaccia di HA — non serve token, perché essendo aperta nella stessa
   origine puoi comunque usare la connessione API descritta più sotto (usa comunque un
   Long-Lived Access Token, HA non passa credenziali automaticamente agli iframe).

### D) Uso locale, senza installare nulla

Apri semplicemente `index.html` con doppio click / dal browser. Funziona subito; l'unica
differenza è che l'installazione come PWA e il funzionamento offline della cache richiedono che la
pagina sia servita via `http(s)://` (va bene anche `http://localhost`), non `file://`.

---

## 3. Collega Home Assistant

1. In HA: **Profilo utente → Sicurezza → Long-Lived Access Tokens → Crea token**, copialo.
2. Nell'app, scheda **Impostazioni**: inserisci URL base (es. `http://homeassistant.local:8123` o
   l'IP della tua istanza) e il token, poi **Connetti e carica entità**.
3. Se ottieni un errore di rete/CORS, aggiungi in `configuration.yaml` di HA:

   ```yaml
   http:
     cors_allowed_origins:
       - "*"   # oppure l'origine esatta da cui apri l'app, es. https://TUO-USER.github.io
   ```

   e riavvia HA.

4. Vai su **Mappa**: disegna prato/aiuole, calibra la scala reale, posiziona irrigatori e sensori.
   Quando posizioni un sensore, agganciane subito l'entità HA (meteo, pioggia, umidità suolo).
5. Vai su **Zone & Pompa**: collega ogni valvola e la pompa al relativo relè smart, imposta portata
   massima pompa e pressione di zona.
6. Usa **Controllo manuale**, **Timer** o **Automatico** per irrigare. In **Automatico** puoi anche
   generare un'automazione YAML nativa di HA, per avere un programma affidabile anche quando questa
   app non è aperta.

---

## Struttura del repository

```
.
├── repository.yaml           # rende questo repo riconoscibile come "repository di add-on" per HA
├── irrigaha/                 # ── l'add-on vero e proprio ──
│   ├── config.yaml           #   manifest add-on (nome, ingress, icona pannello...)
│   ├── Dockerfile            #   immagine nginx + file statici dell'app
│   ├── icon.png / logo.png   #   immagini mostrate nell'Add-on Store
│   ├── DOCS.md                #   documentazione mostrata dentro HA
│   └── www/                  #   copia dell'app (index.html, manifest, sw.js, icons/)
├── index.html                # ── stessa app, in root, per le modalità B/C/D ──
├── manifest.json / sw.js / icons/   # PWA (installazione da GitHub Pages o www/ locale)
├── .github/workflows/pages.yml     # pubblicazione automatica su GitHub Pages
├── LICENSE
└── README.md
```

> Nota: l'app in `index.html` (root) e quella copiata in `irrigaha/www/index.html` sono lo stesso
> file. Se la modifichi, ricordati di copiarla in entrambi i punti (o rimuovi la copia in root se
> userai solo la modalità Add-on).

## Limiti noti

- Il timer e la modalità automatica "dal vivo" richiedono che l'app resti aperta nel browser;
  per un'automazione realmente indipendente usa il pulsante **"Genera automazione HA (YAML)"**
  nella scheda Automatico e importala come automazione nativa di Home Assistant.
- Le chiamate verso HA partono dal browser dell'utente: l'istanza HA dev'essere raggiungibile in
  rete da quel dispositivo (rete locale o esposizione remota già configurata da te).
- I dati di portata/gittata nel database irrigatori sono presi dalle schede tecniche ufficiali per
  Rain Bird 5000 e Hunter PGP Ultra; le altre marche sono valori indicativi da verificare sulla
  scheda del modello posseduto — modificabili liberamente dalla scheda **Database irrigatori**.
- Lo stato è salvato in `localStorage`: è locale al browser/dispositivo, non sincronizzato tra più
  dispositivi.

## Licenza

MIT — vedi [LICENSE](LICENSE).
