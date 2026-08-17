"""IRRIGAZIONE SMART binary sensors."""
from homeassistant.components.binary_sensor import BinarySensorEntity
from .entity import IrrigationSmartEntity
from .const import DOMAIN

async def async_setup_entry(hass, entry, async_add_entities):
    c=hass.data[DOMAIN][entry.entry_id]["coordinator"]; async_add_entities([RunningSensor(c,entry)]+[NeedWaterSensor(c,entry,z) for z in c.store.data.get("zones",[])])

class RunningSensor(IrrigationSmartEntity, BinarySensorEntity):
    _attr_name="Irrigazione in corso"
    def __init__(self,c,e):super().__init__(c,e,"running")
    @property
    def is_on(self):return self.coordinator.controller.running

class NeedWaterSensor(IrrigationSmartEntity, BinarySensorEntity):
    def __init__(self,c,e,z):super().__init__(c,e,f"{z['id']}_needs_water");self.z=z;self._attr_name=f"{z['name']} necessita acqua"
    @property
    def is_on(self):return self.coordinator.store.data.get("plans",{}).get(self.z["id"],{}).get("minutes",0)>0
