# Changelog

## 1.1.0
- Aggiunta la Home dashboard con anteprima 3D, meteo, stato zone e stop rapido.
- Aggiunto il tubo gocciolante (polilinea, database dedicato, calcolo portata per lunghezza).
- Aggiunta la vegetazione decorativa (alberi, siepi, cespugli, piante).
- Aggiunte aree tipizzate (prato, ghiaia, terra, aiuola) con texture dedicate.
- Ampliato il database irrigatori con più marche/modelli e link alle schede tecniche ufficiali.
- Three.js ora servito in locale (nessuna dipendenza da CDN esterne a runtime).
- Riscritto il motore di animazione (2D e 3D) per maggiore affidabilità.
- Aggiunto numero di versione visibile in-app (Home, Gestione, Impostazioni).
- Service worker: strategia "rete-prima" per la pagina principale, per evitare che una
  versione vecchia resti bloccata in cache dopo un aggiornamento.

## 1.0.0
- Prima versione: mappa 2D/3D, zone e pompa, controllo manuale, timer, automazione meteo,
  database irrigatori base, connessione a Home Assistant via API REST.
