"""Automatic mode switch."""
from homeassistant.components.switch import SwitchEntity
from .entity import IrrigationSmartEntity
from .const import DOMAIN

async def async_setup_entry(hass,entry,async_add_entities): async_add_entities([AutomaticSwitch(hass.data[DOMAIN][entry.entry_id]["coordinator"],entry)])

class AutomaticSwitch(IrrigationSmartEntity,SwitchEntity):
    _attr_name="Automatico"
    def __init__(self,c,e):super().__init__(c,e,"automatic")
    @property
    def is_on(self):return self.coordinator.store.data.get("enabled",True)
    async def async_turn_on(self,**kwargs):self.coordinator.store.data["enabled"]=True;await self.coordinator.store.async_save();self.coordinator.async_set_updated_data(self.coordinator._snapshot())
    async def async_turn_off(self,**kwargs):self.coordinator.store.data["enabled"]=False;await self.coordinator.controller.async_stop_all();await self.coordinator.store.async_save();self.coordinator.async_set_updated_data(self.coordinator._snapshot())
