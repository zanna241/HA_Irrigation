# Add-on minimale: serve i file statici dell'app tramite nginx.
# Immagine multi-arch, nessuna base image HA richiesta.
FROM nginx:alpine

LABEL io.hass.type="addon"
LABEL io.hass.name="IrrigaHA"
LABEL io.hass.description="Regia irrigazione a mappa collegata a Home Assistant"

COPY www/ /usr/share/nginx/html/

EXPOSE 80
