# IRRIGAZIONE SMART

Custom component per Home Assistant per progettare, controllare e programmare un impianto di irrigazione con mappa 2D, vista 3D, zone, pompa, sensori e bilancio idrico.

## Versione

Release corrente: **3.4.0**.

## Novità principali 3.4.0

- Registro operativo permanente di pompa e zone, eliminabile solo manualmente.
- Litri e durata registrati per ogni ciclo di zona.
- Log delle ultime 24 ore nella Home e dell'ultimo mese nella scheda **LOG**.
- Contalitri giornaliero dinamico nella vista 3D.
- Uso del sensore di portata reale, quando configurato; in alternativa viene usata la portata stimata della zona.
- Registro persistente delle verifiche automatiche con conservazione di 90 giorni.
- Ridimensionamento dell'appezzamento indipendente da aree, irrigatori, tubi, piante e sensori.
- Etichetta **Durata (minuti)** nella programmazione manuale.

## Installazione manuale

1. Scaricare lo ZIP della release dalla cartella `release`.
2. Estrarre la cartella `irrigaha` in:

   ```text
   /config/custom_components/irrigaha
   ```

3. Riavviare completamente Home Assistant.
4. Aprire **Impostazioni → Dispositivi e servizi → Aggiungi integrazione**.
5. Cercare **IRRIGAZIONE SMART** e completare la configurazione.
6. Se il frontend mostra ancora la versione precedente, eseguire un aggiornamento forzato con `Ctrl+F5`.

## Aggiornamento da una versione precedente

1. Creare un backup dall'applicazione tramite **Istruzioni → Esporta backup**.
2. Sostituire completamente `/config/custom_components/irrigaha`.
3. Riavviare Home Assistant.
4. Verificare che nella Home appaia `v3.4.0`.

Lo storage esistente viene migrato automaticamente. I registri operativi backend non vengono cancellati dai normali salvataggi del progetto grafico.

## Registri

### Registro operativo

Registra richieste di avvio, apertura e chiusura valvole, avvio e arresto pompa e completamento del ciclo. Non ha scadenza automatica. La cancellazione completa è disponibile nella scheda **LOG** e richiede un utente amministratore.

### Registro verifiche automatiche

Registra controlli pianificati, verifiche manuali, condizioni meteo e risultato per zona. I record più vecchi di 90 giorni vengono rimossi automaticamente durante le valutazioni successive.

## Calcolo dei litri

Se è configurato un sensore di portata reale in `l/min`, il backend integra le letture durante il funzionamento. Se il sensore non è disponibile, usa:

```text
litri = portata stimata della zona × minuti effettivi
```

## Sicurezza idraulica

- Avvio: apertura valvola → attesa configurata → avvio pompa.
- Arresto: spegnimento pompa → attesa configurata → chiusura valvola.
- Il backend consente una sola zona alla volta nei programmi immediati e pianificati.

## Compatibilità

- Home Assistant con supporto ai custom component e `panel_custom`.
- Browser con moduli JavaScript; WebGL consigliato per la vista 3D.

## Struttura repository

```text
custom_components/irrigaha/   componente Home Assistant
release/                      pacchetto ZIP installabile
CHANGELOG.md                  cronologia modifiche
RELEASE_NOTES_3.4.0.md        testo pronto per una release GitHub
```
