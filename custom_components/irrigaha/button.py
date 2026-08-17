"""Control buttons."""
from homeassistant.components.button import ButtonEntity
from .entity import IrrigationSmartEntity
from .const import DOMAIN

async def async_setup_entry(hass,entry,async_add_entities):
    c=hass.data[DOMAIN][entry.entry_id]["coordinator"];async_add_entities([ActionButton(c,entry,"recalculate","Ricalcola",c.async_evaluate),ActionButton(c,entry,"stop_all","Arresto generale",c.controller.async_stop_all)])

class ActionButton(IrrigationSmartEntity,ButtonEntity):
    def __init__(self,c,e,key,name,action):super().__init__(c,e,key);self._attr_name=name;self.action=action
    async def async_press(self):await self.action();self.coordinator.async_set_updated_data(self.coordinator._snapshot())
