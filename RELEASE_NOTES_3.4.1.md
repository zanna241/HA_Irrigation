# IRRIGAZIONE SMART 3.4.1

Release dedicata alla sicurezza della pompa e all'inquadratura automatica della vista 3D.

## Sicurezza pompa

- Tempo massimo continuativo configurabile, predefinito a 120 minuti.
- Arresto opzionale dopo 30 secondi senza portata; richiede un sensore in l/min.
- Arresto opzionale quando tutte le valvole configurate risultano chiuse.
- Tutti gli arresti di sicurezza vengono salvati nel registro persistente.

I due controlli opzionali restano disattivati dopo l'aggiornamento, così non modificano il comportamento degli impianti esistenti senza una scelta esplicita.

## Vista 3D

La camera iniziale usa un vero fit della scena rispetto sia alla larghezza sia all'altezza disponibili. Il fit viene ricalcolato automaticamente quando il pannello viene ingrandito o ridotto.

## Aggiornamento

Sostituire completamente `/config/custom_components/irrigaha`, riavviare Home Assistant ed eseguire `Ctrl+F5`.
