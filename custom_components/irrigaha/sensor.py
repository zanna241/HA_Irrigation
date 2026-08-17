"""IRRIGAZIONE SMART sensors."""
from homeassistant.components.sensor import SensorEntity, SensorDeviceClass
from .entity import IrrigationSmartEntity
from .const import DOMAIN


async def async_setup_entry(hass, entry, async_add_entities):
    c = hass.data[DOMAIN][entry.entry_id]["coordinator"]
    entities = [GlobalSensor(c, entry, "last_evaluation", "Ultima valutazione"), GlobalSensor(c, entry, "water_today", "Acqua erogata oggi", "L")]
    for zone in c.store.data.get("zones", []):
        entities += [ZoneSensor(c, entry, zone["id"], "minutes", "Minuti pianificati", "min"), ZoneSensor(c, entry, zone["id"], "liters", "Acqua pianificata", "L"), ZoneSensor(c, entry, zone["id"], "net_mm", "Fabbisogno", "mm")]
    async_add_entities(entities)


class GlobalSensor(IrrigationSmartEntity, SensorEntity):
    def __init__(self, c, entry, key, name, unit=None): super().__init__(c, entry, key); self.key=key; self._attr_name=name; self._attr_native_unit_of_measurement=unit
    @property
    def native_value(self):
        if self.key == "water_today":
            from homeassistant.util import dt as dt_util
            today=dt_util.now().date().isoformat(); return round(sum(float(x.get("liters",0)) for x in self.coordinator.store.data.get("water_ledger",[]) if str(x.get("timestamp","")).startswith(today)),1)
        return self.coordinator.store.data.get(self.key)


class ZoneSensor(IrrigationSmartEntity, SensorEntity):
    def __init__(self,c,entry,zid,key,name,unit): super().__init__(c,entry,f"{zid}_{key}"); self.zid=zid;self.key=key;self._attr_name=f"{name} {zid}";self._attr_native_unit_of_measurement=unit
    @property
    def native_value(self): return self.coordinator.store.data.get("plans",{}).get(self.zid,{}).get(self.key,0)
