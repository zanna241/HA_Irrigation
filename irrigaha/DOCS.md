# IrrigaHA — Add-on

App a mappa per progettare l'irrigazione (prato, ghiaia, terra, aiuole, alberi/siepi/piante
decorative) e comandarla — manualmente, a timer o in automatico in base al meteo — tramite le
entità di Home Assistant (relè smart per valvole/pompa, centraline Tuya-compatibili o simili già
integrate in HA). Gira interamente in locale: nessuna pagina esterna, nessuna dipendenza da
internet a runtime (Three.js per l'anteprima 3D è incluso nell'add-on, non caricato da CDN).

## Cosa include

- **Home**: dashboard con anteprima 3D animata del giardino, meteo, stato zone, pulsante di
  arresto rapido e accesso alle impostazioni.
- **Mappa**: editor 2D (prato/ghiaia/terra/aiuola, irrigatori, tubo gocciolante a polilinea,
  alberi/siepi/piante decorative, sensori) + anteprima 3D con getti d'acqua animati sulle zone
  attive.
- **Zone & Pompa**, **Controllo manuale**, **Timer**, **Automatico** (con generazione di
  un'automazione HA in YAML per funzionare anche ad app chiusa).
- **Database irrigatori**: modelli Rain Bird, Hunter, Gardena, Toro, K-Rain, Irritrol e tubi
  gocciolanti (Rain Bird XF, Gardena Micro-Drip, Netafim, Claber), ciascuno con link alla scheda
  tecnica ufficiale dove disponibile.

## Installazione

1. **Impostazioni → Add-on, backup e supervisor → Add-on Store**.
2. Menu **⋮ (in alto a destra) → Repository**, incolla l'URL di questo repository GitHub e
   conferma.
3. Cerca **"IrrigaHA"** nello store, apri la scheda e premi **Installa**.
4. Premi **Avvia**. Attiva **"Mostra nella sidebar"** per trovarla nel menu laterale di HA.

## Primo utilizzo

L'add-on serve solo l'interfaccia: la connessione ai tuoi dispositivi va fatta dall'app stessa.

1. Apri "Irrigazione" dalla sidebar — si apre sulla **Home**.
2. Tocca l'icona ⚙️ per entrare nella schermata di gestione, scheda **Impostazioni**, e inserisci:
   - **URL base**: l'indirizzo con cui normalmente apri Home Assistant (es.
     `http://homeassistant.local:8123`). Usare lo stesso URL da cui accedi di solito evita del
     tutto problemi di CORS, perché l'add-on viene aperto in Ingress sulla stessa origine.
   - **Long-Lived Access Token**: crealo da *Profilo utente → Sicurezza → Long-Lived Access
     Tokens*.
3. Premi **Connetti e carica entità**, poi vai su **Mappa** per disegnare il giardino: aree,
   irrigatori (con marca/modello dal database), tubi gocciolanti, vegetazione decorativa e
   sensori.
4. Torna alla **Home** per la vista d'insieme 3D, il meteo e lo stop rapido.

> Nota: l'Ingress rende l'add-on visibile e navigabile dentro l'interfaccia di HA, ma non
> concede automaticamente un token di accesso alle API — va comunque generato e incollato una
> volta come sopra.

## Requisiti

Richiede **Home Assistant OS** o un'installazione **Supervised** (l'Add-on Store non è
disponibile su installazioni Core/Container senza Supervisor: in quel caso usa in alternativa la
modalità "pannello iframe" descritta nel README principale del repository).

## Supporto

Segnalazioni e richieste tramite le Issue del repository GitHub.
