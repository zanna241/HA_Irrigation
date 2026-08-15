# Changelog

## 1.2.0
- **Fix**: la mappa 2D nella schermata di Gestione restava invisibile (larghezza 0) perché si
  ridimensionava solo all'avvio, mentre quello schermo era ancora nascosto dietro la Home.
  Ora si ridimensiona correttamente ogni volta che entri in Gestione o torni alla vista 2D.
- **Fix**: il database irrigatori non mostrava i link alle schede tecniche pur essendo presenti
  nei dati — corretta la tabella.
- Aggiunta una tabella dedicata al **database tubo gocciolante**, con possibilità di aggiungere
  prodotti manualmente (marca, modello, spaziatura, portata gocciolatore/metro, link scheda).
- Il modulo "Aggiungi modello" per gli irrigatori ora include anche il link alla scheda tecnica.
- Chiarita nell'interfaccia la separazione tra **aree** (prato/ghiaia/terra/aiuola — solo
  rappresentazione grafica) e **zone** (impianto di irrigazione vero e proprio: gruppo di
  irrigatori/tubi comandati da un relè). Ogni zona ora mostra automaticamente sopra quale area
  disegnata ricadono i suoi dispositivi, a titolo puramente informativo.

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
# 1.3.0

- Dimensionamento iniziale obbligatorio dell'appezzamento con righelli metrici.
- Misura dinamica sulla linea elastica e rimozione dei punti duplicati da doppio clic.
- Rimossa la texture verticale del prato e migliorata la vegetazione con simboli vettoriali.
- Database ripulito: mantenuti solo link ufficiali verificati.
- Sequenza sicura: valvola, ritardo, pompa in avvio; pompa, ritardo, valvola in arresto.
- Ritardo configurabile applicato a Home, manuale, timer, emergenza e YAML Home Assistant.
