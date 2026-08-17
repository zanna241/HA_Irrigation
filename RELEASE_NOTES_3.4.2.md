# IRRIGAZIONE SMART 3.4.2

Questa release introduce l'esclusione completa delle zone in manutenzione e rende più leggibile la scena 3D nella Home.

## Zone in manutenzione

Nella scheda **Zone & Pompa** è disponibile una checkbox dedicata per ogni zona. Quando selezionata:

- la zona non può essere avviata manualmente;
- viene esclusa dai programmi immediati e settimanali;
- viene esclusa dalla pianificazione automatica;
- gli avvii tramite servizi Home Assistant vengono respinti;
- un eventuale ciclo già attivo viene arrestato dal controller;
- tentativi e arresti vengono registrati nel log persistente.

## Home e vista 3D

- La distanza iniziale della camera Home utilizza un fattore `0,84`, rendendo il giardino circa il 19% più grande rispetto alla release precedente.
- La vista continua ad adattarsi automaticamente alle dimensioni della finestra.
- Il logo MZ è mostrato in alto a destra nella Home e alla fine delle istruzioni.

## Programmazione manuale

Sono ora presenti descrizioni esplicite per durata della zona, ora di avvio e checkbox dei giorni attivi.

## Aggiornamento

Sostituire completamente `/config/custom_components/irrigaha`, riavviare Home Assistant ed eseguire `Ctrl+F5`.
