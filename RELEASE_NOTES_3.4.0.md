# IRRIGAZIONE SMART 3.4.0

Questa release introduce uno storico completo e persistente dell'impianto e rende indipendente il ridimensionamento del lotto dagli oggetti già disegnati.

## In evidenza

- Log permanente di tutte le operazioni su zone e pompa.
- Litri erogati e durata effettiva per ogni zona.
- Ultime 24 ore consultabili direttamente dalla Home.
- Ultimo mese consultabile nella nuova scheda **LOG**.
- Contalitri giornaliero in tempo reale nella vista 3D.
- Verifiche automatiche conservate per 90 giorni.
- Oggetti grafici non più ridimensionati modificando l'appezzamento.

Quando è configurato un sensore di portata, i litri vengono integrati dalle letture reali. In assenza del sensore viene utilizzata la portata stimata della zona.

## Aggiornamento

Sostituire completamente la cartella `custom_components/irrigaha`, riavviare Home Assistant ed eseguire `Ctrl+F5`. La configurazione esistente viene mantenuta e migrata automaticamente.

## Verifiche consigliate dopo l'aggiornamento

1. Avviare una zona manualmente e controllare che il contalitri aumenti.
2. Arrestare la zona e verificare il ciclo nella Home → **Log ultime 24 ore**.
3. Aprire Gestione → **LOG** e controllare durata e litri.
4. Eseguire **Automatico → Verifica adesso** e verificare la nuova voce persistente.
5. Modificare le dimensioni dell'appezzamento e controllare che gli oggetti mantengano le dimensioni reali.
