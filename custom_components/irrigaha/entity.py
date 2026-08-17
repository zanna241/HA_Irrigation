"""Base entity."""
from homeassistant.helpers.update_coordinator import CoordinatorEntity
from .const import DOMAIN


class IrrigationSmartEntity(CoordinatorEntity):
    _attr_has_entity_name = True
    def __init__(self, coordinator, entry, key):
        super().__init__(coordinator); self._entry = entry; self._attr_unique_id = f"{entry.entry_id}_{key}"; self._attr_device_info = {"identifiers": {(DOMAIN, entry.entry_id)}, "name": "IRRIGAZIONE SMART", "manufacturer": "IRRIGAZIONE SMART", "model": "Native 2.0"}
