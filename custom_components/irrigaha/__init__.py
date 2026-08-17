"""IRRIGAZIONE SMART native integration."""
from __future__ import annotations
import asyncio
import json
from pathlib import Path
import voluptuous as vol

from homeassistant.components import panel_custom
from homeassistant.components.http import StaticPathConfig
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.helpers import config_validation as cv

from .const import DOMAIN, PLATFORMS, SERVICE_RECALCULATE, SERVICE_START_ZONE, SERVICE_STOP_ALL
from .storage import IrrigationSmartStore
from .hydraulic_controller import HydraulicController
from .coordinator import IrrigationSmartCoordinator
from .websocket_api import async_register_websocket


async def async_setup(hass: HomeAssistant, _config: dict) -> bool:
    hass.data.setdefault(DOMAIN, {})
    if not hass.data[DOMAIN].get("static_registered"):
        root = Path(__file__).parent
        await hass.http.async_register_static_paths(
            [StaticPathConfig("/irrigaha_static", str(root / "frontend"), False)]
        )
        hass.data[DOMAIN]["static_registered"] = True
    return True


async def async_setup_entry(hass: HomeAssistant, entry) -> bool:
    root = Path(__file__).parent
    if entry.title != "IRRIGAZIONE SMART":
        hass.config_entries.async_update_entry(entry, title="IRRIGAZIONE SMART")
    store = IrrigationSmartStore(hass); await store.async_load()
    # The config flow seeds a new installation. Afterwards the native panel owns
    # runtime configuration; explicit HA options still take precedence.
    for key, value in entry.data.items():
        if value is not None and not store.data.get(key):
            store.data[key] = value
    store.data.update({key: value for key, value in entry.options.items() if value is not None})
    await store.async_save()
    catalog = {p["id"]: p for p in json.loads((root / "catalog" / "plants.json").read_text())}
    catalog.update({p["id"]: p for p in store.data.get("custom_plants", [])})
    controller = HydraulicController(hass, store)
    coordinator = IrrigationSmartCoordinator(hass, store, controller, catalog)
    hass.data[DOMAIN][entry.entry_id] = {
        "entry_id": entry.entry_id,
        "store": store,
        "controller": controller,
        "coordinator": coordinator,
        "catalog": catalog,
        "save_lock": asyncio.Lock(),
    }

    if not hass.data[DOMAIN].get("panel_registered"):
        await panel_custom.async_register_panel(hass, webcomponent_name="irrigaha-panel", frontend_url_path="irrigaha", module_url="/irrigaha_static/irrigaha-panel.js?v=3.4.2", sidebar_title="IRRIGAZIONE SMART", sidebar_icon="mdi:sprinkler-variant", require_admin=False, config={"entry_id": entry.entry_id})
        hass.data[DOMAIN]["panel_registered"] = True
    async_register_websocket(hass)

    async def recalculate(_call: ServiceCall): await coordinator.async_evaluate("service")
    async def stop_all(_call: ServiceCall): await controller.async_stop_all(); coordinator.async_set_updated_data(coordinator._snapshot())
    async def start_zone(call: ServiceCall):
        zone = next((z for z in store.data["zones"] if z["id"] == call.data["zone_id"]), None)
        if zone: await controller.async_run_zone(zone, call.data.get("minutes", 10), "service")

    if not hass.services.has_service(DOMAIN, SERVICE_RECALCULATE):
        hass.services.async_register(DOMAIN, SERVICE_RECALCULATE, recalculate)
        hass.services.async_register(DOMAIN, SERVICE_STOP_ALL, stop_all)
        hass.services.async_register(DOMAIN, SERVICE_START_ZONE, start_zone, schema=vol.Schema({vol.Required("zone_id"): cv.string, vol.Optional("minutes", default=10): vol.Coerce(float)}))

    entry.async_on_unload(entry.add_update_listener(_async_reload_entry))
    await hass.config_entries.async_forward_entry_setups(entry, [Platform(p) for p in PLATFORMS])
    hass.async_create_task(coordinator.async_start())
    return True


async def async_unload_entry(hass, entry):
    data = hass.data[DOMAIN].pop(entry.entry_id)
    await data["coordinator"].async_shutdown()
    return await hass.config_entries.async_unload_platforms(entry, [Platform(p) for p in PLATFORMS])


async def _async_reload_entry(hass, entry):
    await hass.config_entries.async_reload(entry.entry_id)
