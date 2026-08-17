# Changelog

## 3.4.2 — 2026-08-17

### Aggiunto

- Stato persistente **Zona in manutenzione**.
- Blocco degli avvii manuali, immediati, settimanali, automatici e tramite servizio HA per le zone escluse.
- Arresto controllato entro il ciclo di sorveglianza se la manutenzione viene attivata durante l'irrigazione.
- Evento di log per i tentativi di avvio bloccati dalla manutenzione.
- Logo MZ ottimizzato e incorporato nella Home e nelle istruzioni.
- Descrizioni di durata, ora di avvio e selezione dei giorni in Prog. Manuale.

### Modificato

- Fit iniziale della Home 3D portato a `0,84`, circa il 19% più ravvicinato.
- Il piano automatico indica le zone in manutenzione come bloccate e assegna durata e litri pari a zero.

## 3.4.1 — 2026-08-17

### Aggiunto

- Limite massimo configurabile del funzionamento continuativo della pompa.
- Watchdog opzionale di portata zero: arresto dopo 30 secondi sotto 0,05 l/min o con sensore non disponibile.
- Watchdog opzionale per tutte le valvole configurate in stato `off`.
- Evento persistente `pump_safety_stop` con causa, durata e litri erogati.

### Modificato

- Il limite pompa viene imposto dal controller backend a comandi manuali, programmi, automatismi e servizi.
- La camera 3D calcola il fit usando FOV verticale, FOV orizzontale e proporzioni reali del contenitore.
- La scena viene nuovamente adattata quando cambia la dimensione della finestra.

## 3.4.0 — 2026-08-17

### Aggiunto

- Registro operativo persistente e senza scadenza per pompa e zone.
- Eventi per richiesta zona, valvola aperta/chiusa, pompa avviata/arrestata e ciclo completato.
- Litri, minuti, zona e origine del comando nei cicli completati.
- Tab **Log ultime 24 ore** nella Home.
- Tab **LOG** nella Gestione con operazioni dell'ultimo mese.
- Cancellazione manuale amministrativa del registro operativo.
- Contalitri giornaliero live sovrapposto alla scena 3D.
- Integrazione del sensore di portata reale durante l'irrigazione.
- Endpoint runtime leggero per aggiornare il contatore senza trasferire l'intero storico.
- Registro verifiche automatiche persistente con conservazione di 90 giorni.
- Origine delle verifiche: avvio, pianificata, esecuzione pianificata, servizio o interfaccia.
- Etichetta **Durata (minuti)** per ogni zona nella programmazione manuale.

### Modificato

- Tutti i comandi manuali e immediati passano dal controller idraulico backend.
- I programmi immediati vengono eseguiti in sequenza sicura, una zona alla volta.
- Il ridimensionamento del lotto preserva dimensioni e coordinate metriche degli oggetti esistenti.
- Il registro acqua non viene più limitato automaticamente agli ultimi 2.000 record.
- I registri backend vengono preservati durante i salvataggi del progetto grafico.
- Normalizzazione automatica dei vecchi record acqua con campi `ts`/`zoneId`.

### Corretto

- Perdita dei registri durante la sincronizzazione legacy del frontend.
- Possibili duplicazioni dei litri tra frontend e controller backend.
- Ridimensionamento involontario di aree, irrigatori, piante, sensori e tubi modificando l'appezzamento.

## 3.3.9

- Eliminato il flickering delle superfici 3D mediante separazione delle quote e `polygonOffset`.
- Corretti bias delle ombre e posizione dei tubi gocciolanti.

## 3.3.8

- Protetta la scala metrica durante la navigazione tra pannelli Home Assistant.

## 3.3.7

- Uniformato il piano del lotto allo sfondo della vista 3D.

## 3.3.6

- Corretta la sovrapposizione tra fallback isometrico, WebGL e comandi Home.

## 3.3.5

- Ripristino automatico della scena tornando da un altro pannello Home Assistant.
