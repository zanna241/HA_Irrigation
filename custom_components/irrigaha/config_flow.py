"""UI configuration flow for IRRIGAZIONE SMART."""
from __future__ import annotations

import voluptuous as vol
from homeassistant import config_entries
from homeassistant.helpers import selector

from .const import DOMAIN


class IrrigationSmartConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input=None):
        if self._async_current_entries():
            return self.async_abort(reason="single_instance_allowed")
        if user_input is not None:
            return self.async_create_entry(title="IRRIGAZIONE SMART", data=user_input)
        schema = vol.Schema({
            vol.Required("pump_entity"): selector.EntitySelector(
                selector.EntitySelectorConfig(domain=["switch", "input_boolean"])
            ),
            vol.Required("weather_entity"): selector.EntitySelector(
                selector.EntitySelectorConfig(domain="weather")
            ),
            # An optional EntitySelector must not receive an empty-string
            # default: HA correctly rejects "" as neither an entity ID nor UUID.
            vol.Optional("rain_sensor"): selector.EntitySelector(
                selector.EntitySelectorConfig(domain="binary_sensor")
            ),
        })
        return self.async_show_form(step_id="user", data_schema=schema)

    @staticmethod
    def async_get_options_flow(config_entry):
        return IrrigationSmartOptionsFlow(config_entry)


class IrrigationSmartOptionsFlow(config_entries.OptionsFlow):
    def __init__(self, entry):
        self.entry = entry

    async def async_step_init(self, user_input=None):
        values = {**self.entry.data, **self.entry.options}
        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)
        rain_key = (
            vol.Optional("rain_sensor", default=values["rain_sensor"])
            if values.get("rain_sensor")
            else vol.Optional("rain_sensor")
        )
        return self.async_show_form(step_id="init", data_schema=vol.Schema({
            vol.Required("pump_entity", default=values.get("pump_entity", "")): selector.EntitySelector(
                selector.EntitySelectorConfig(domain=["switch", "input_boolean"])
            ),
            vol.Required("weather_entity", default=values.get("weather_entity", "")): selector.EntitySelector(
                selector.EntitySelectorConfig(domain="weather")
            ),
            rain_key: selector.EntitySelector(
                selector.EntitySelectorConfig(domain="binary_sensor")
            ),
        }))
