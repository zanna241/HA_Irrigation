# Changelog

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
