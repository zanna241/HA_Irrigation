# IrrigaHA — Add-on

App a mappa per progettare l'irrigazione (prato/aiuole, irrigatori, sensori) e comandarla —
manualmente, a timer o in automatico in base al meteo — tramite le entità di Home Assistant
(relè smart per valvole/pompa, centraline Tuya-compatibili o simili già integrate in HA).

## Installazione

1. **Impostazioni → Add-on, backup e supervisor → Add-on Store**.
2. Menu **⋮ (in alto a destra) → Repository**, incolla l'URL di questo repository GitHub e
   conferma.
3. Cerca **"IrrigaHA"** nello store, apri la scheda e premi **Installa**.
4. Premi **Avvia**. Attiva **"Mostra nella sidebar"** per trovarla nel menu laterale di HA.

## Primo utilizzo

L'add-on serve solo l'interfaccia: la connessione ai tuoi dispositivi va fatta dall'app stessa.

1. Apri "Irrigazione" dalla sidebar.
2. Vai su **Impostazioni** e inserisci:
   - **URL base**: l'indirizzo con cui normalmente apri Home Assistant (es.
     `http://homeassistant.local:8123`). Usare lo stesso URL da cui accedi di solito evita del
     tutto problemi di CORS, perché l'add-on viene aperto in Ingress sulla stessa origine.
   - **Long-Lived Access Token**: crealo da *Profilo utente → Sicurezza → Long-Lived Access
     Tokens*.
3. Premi **Connetti e carica entità**, poi vai su **Mappa** per disegnare il giardino.

> Nota: l'Ingress rende l'add-on visibile e navigabile dentro l'interfaccia di HA, ma non
> concede automaticamente un token di accesso alle API — va comunque generato e incollato una
> volta come sopra.

## Requisiti

Richiede **Home Assistant OS** o un'installazione **Supervised** (l'Add-on Store non è
disponibile su installazioni Core/Container senza Supervisor: in quel caso usa in alternativa la
modalità "pannello iframe" o "PWA" descritta nel README principale del repository).

## Supporto

Segnalazioni e richieste tramite le Issue del repository GitHub.
