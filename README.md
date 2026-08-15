# 💧 IrrigaHA — Regia irrigazione a mappa per Home Assistant

App per progettare graficamente il proprio giardino (prato, ghiaia, terra, aiuole, alberi/siepi/
piante), posizionare irrigatori e tubi gocciolanti, e comandare l'irrigazione — manuale, a timer
o automatica in base al meteo — tramite le entità di **Home Assistant** (relè smart per valvole
di zona e pompa, centraline meteo Tuya-compatibili o simili già integrate in HA).

**Gira interamente in locale.** Nessuna pagina esterna, nessun hosting su internet, nessuna CDN a
runtime: tutto (interfaccia, libreria 3D, icone) è servito dalla tua istanza Home Assistant sulla
tua rete. L'unica connessione di rete che l'app fa è verso la tua istanza HA, dal browser del tuo
dispositivo.

La versione 1.5.0 aggiunge rivalutazioni multiple persistenti in Home Assistant, piano salvato per
zona, verifica pre-avvio e protezione dalle doppie irrigazioni giornaliere.

Il file generato dalla scheda Automatico va salvato come `/config/packages/irrigaha.yaml`. In
`configuration.yaml` deve essere presente:

```yaml
homeassistant:
  packages: !include_dir_named packages
```

Prima del riavvio usare sempre il controllo configurazione di Home Assistant.

- 🏠 **Home**: dashboard con anteprima 3D animata del giardino, meteo, stato zone e stop rapido
- 🗺️ **Editor a mappa**: aree tipizzate (prato/ghiaia/terra/aiuola), irrigatori con gittata/arco/
  rotazione, **tubo gocciolante a polilinea**, alberi/siepi/piante decorative, sensori
- 🚿 Zone e pompa collegate a relè smart HA, con calcolo portata stimata per zona
- 🎛️ Controllo manuale, ⏱️ timer, 🌦️ modalità automatica con regole meteo/umidità suolo
- 📘 Database irrigatori (Rain Bird, Hunter, Gardena, Toro, K-Rain, Irritrol + tubi gocciolanti
  Rain Bird XF / Gardena Micro-Drip / Netafim / Claber) con **link alla scheda tecnica ufficiale**
- 🧊 Anteprima 3D animata: getti d'acqua e gocciolamento visibili sulle zone in funzione

Tutto lo stato (mappa, zone, timer, credenziali HA) resta **solo nel browser del dispositivo**
(`localStorage`).

---

## Installazione — Add-on per Home Assistant OS / Supervised

Il modo pensato per questa app: gira come container gestito da HA e, con Ingress attivo, appare
direttamente nella sidebar. Nessuna configurazione di CORS da fare a mano se usi lo stesso URL con
cui apri normalmente HA.

1. Carica il contenuto di questo repository su GitHub (struttura piatta, così com'è).
2. In Home Assistant: **Impostazioni → Add-on, backup e supervisor → Add-on Store**.
3. Menu **⋮ → Repository**, incolla l'URL del tuo repository GitHub, conferma.
4. Cerca **"IrrigaHA"**, apri la scheda, **Installa**, poi **Avvia**.
5. Attiva **"Mostra nella sidebar"**.
6. Apri "Irrigazione" dalla sidebar (si apre sulla **Home**), tocca ⚙️ per entrare nella gestione
   e vai su **Impostazioni** per collegare Home Assistant (URL + Long-Lived Access Token — va
   comunque creato, l'Ingress non lo genera automaticamente).

Disponibile solo su **Home Assistant OS** o installazioni **Supervised** (l'Add-on Store non
esiste su Core/Container senza Supervisor). Dettagli nella documentazione dell'add-on:
[`irrigaha/DOCS.md`](irrigaha/DOCS.md).

### Come aggiornare l'add-on dopo aver modificato il repository

Home Assistant **non** ricontrolla il repository ad ogni push: lo fa solo quando gliene dai il
comando, e capisce che c'è qualcosa di nuovo solo se il campo `version` in
`irrigaha/config.yaml` è cambiato rispetto a quello già installato. Se dopo un push "non succede
nulla", è quasi sempre uno di questi due motivi. Procedura corretta:

1. **Verifica di aver incrementato la versione.** Ogni modifica che carichi deve accompagnarsi a
   un bump di `version:` in `irrigaha/config.yaml` (es. da `1.1.0` a `1.1.1`) — altrimenti, agli
   occhi di HA, è lo stesso identico add-on di prima e non mostrerà mai un aggiornamento.
2. In HA: **Impostazioni → Add-on, backup e supervisor → Add-on Store**, menu **⋮ → Controlla
   aggiornamenti** (in alcune versioni: ricarica semplicemente la pagina). Se il repository
   punta al tuo GitHub, questo forza HA a rileggere `config.yaml`.
3. Apri la scheda **"IrrigaHA"**: se la versione locale differisce da quella nel repository,
   comparirà un pulsante **Aggiorna**. Premilo.
4. Se non compare nulla nonostante il bump di versione, il repository potrebbe non essere stato
   riclonato: vai su **⋮ → Repository**, rimuovi l'URL e reinseriscilo — questo forza un
   clone pulito.
5. Come **verifica definitiva** di quale versione è effettivamente in esecuzione, apri l'app:
   il numero di versione è mostrato in alto sia in **Home** che in **Gestione**, e anche nella
   scheda **Impostazioni**. Se dopo l'aggiornamento quel numero non cambia, l'add-on non ha
   ancora ricaricato i file nuovi — ripeti dal punto 2.
6. Se il numero in-app è corretto ma la pagina "sembra" ancora vecchia (elementi mancanti,
   stile diverso), è quasi certamente cache del browser: fai un refresh forzato
   (Ctrl/Cmd+Shift+R) — l'app usa un service worker che aggiorna sempre l'HTML principale dalla
   rete, ma i browser a volte tengono comunque una copia in cache finché non forzato.

### In alternativa: pannello nella sidebar senza Supervisor

Se la tua installazione è Core/Container (niente Add-on Store):

1. Copia il contenuto di `irrigaha/www/` dentro `config/www/irrigaha/`.
2. Aggiungi in `configuration.yaml`:

   ```yaml
   panel_iframe:
     irrigaha:
       title: Irrigazione
       icon: mdi:sprinkler-variant
       url: /local/irrigaha/index.html
       require_admin: false
   ```

3. Riavvia Home Assistant. Comparirà "Irrigazione" nella sidebar.
4. Se le chiamate API falliscono per CORS, aggiungi in `configuration.yaml`:

   ```yaml
   http:
     cors_allowed_origins:
       - "*"
   ```

### Uso locale diretto

Apri `irrigaha/www/index.html` col doppio click: funziona subito, senza installare nulla.

---

## Collegare Home Assistant

1. In HA: **Profilo utente → Sicurezza → Long-Lived Access Tokens → Crea token**, copialo.
2. Nell'app, ⚙️ **Impostazioni**: inserisci URL base e token, poi **Connetti e carica entità**.
3. Vai su **Mappa**: disegna prato/ghiaia/terra/aiuole, calibra la scala reale, posiziona
   irrigatori (scegliendo marca/modello dal database, con link alla scheda tecnica), tubi
   gocciolanti (disegnati come polilinea, con calcolo automatico della portata in base alla
   lunghezza reale), alberi/siepi/piante decorative, e sensori — quando posizioni un sensore ti
   viene chiesto subito a quale entità HA agganciarlo (meteo, pioggia, umidità suolo).
4. Vai su **Zone & Pompa**: collega ogni valvola e la pompa al relativo relè smart.
5. Usa **Controllo manuale**, **Timer** o **Automatico**, oppure torna alla **Home** per la vista
   d'insieme 3D e lo stop rapido.

---

## Struttura del repository

```
.
├── repository.yaml           # rende questo repo riconoscibile come "repository di add-on" per HA
├── irrigaha/                 # ── l'add-on ──
│   ├── config.yaml           #   manifest add-on (nome, ingress, icona pannello...)
│   ├── Dockerfile            #   immagine nginx + file statici dell'app
│   ├── icon.png / logo.png   #   immagini mostrate nell'Add-on Store
│   ├── DOCS.md                #   documentazione mostrata dentro HA
│   └── www/                  #   l'app: index.html, manifest.json, sw.js, icons/, vendor/
│       └── vendor/            #   Three.js + OrbitControls serviti in locale (nessuna CDN)
├── LICENSE
└── README.md
```

## Limiti noti

- Il timer e la modalità automatica "dal vivo" richiedono che l'app resti aperta nel browser;
  per un'automazione indipendente usa **"Genera automazione HA (YAML)"** nella scheda Automatico.
- Le chiamate verso HA partono dal browser dell'utente: l'istanza HA dev'essere raggiungibile in
  rete da quel dispositivo.
- I dati di portata/gittata sono presi dalle schede tecniche ufficiali dove indicato; le voci
  segnate "indicativo" vanno verificate sulla scheda del modello posseduto — modificabili
  liberamente dalla scheda **Database irrigatori**.
- Lo stato è salvato in `localStorage`: locale al browser/dispositivo, non sincronizzato tra più
  dispositivi.
- L'anteprima 3D è stilizzata (non fotorealistica) e pensata per dare un colpo d'occhio
  sull'impianto, non come CAD di precisione.

## Licenza

MIT — vedi [LICENSE](LICENSE).
