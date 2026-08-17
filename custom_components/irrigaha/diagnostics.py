"""Diagnostics support for IRRIGAZIONE SMART."""
from __future__ import annotations

from homeassistant.components.diagnostics import async_redact_data

TO_REDACT = {"latitude", "longitude"}


async def async_get_config_entry_diagnostics(hass, entry):
    """Return safe configuration and live planning diagnostics."""
    runtime = hass.data["irrigaha"][entry.entry_id]
    return async_redact_data(
        {
            "entry": {"data": dict(entry.data), "options": dict(entry.options)},
            "configuration": runtime["store"].data,
            "running": runtime["controller"].running,
            "active_zone": runtime["controller"].active_zone,
        },
        TO_REDACT,
    )
