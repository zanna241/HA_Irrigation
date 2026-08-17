"""WebSocket commands consumed by the native panel."""
from __future__ import annotations
import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.util import dt as dt_util
from .const import DOMAIN


def _runtime(hass): return next(v for v in hass.data[DOMAIN].values() if isinstance(v, dict) and "coordinator" in v)


@websocket_api.websocket_command({vol.Required("type"): "irrigaha/get"})
@websocket_api.async_response
async def ws_get(hass, connection, msg):
    rt = _runtime(hass)
    connection.send_result(msg["id"], {"config": rt["store"].data, "catalog": list(rt["catalog"].values()), "running": rt["controller"].running, "active_zone": rt["controller"].active_zone, "active_started_at": rt["controller"].active_started_at, "active_flow_l_min": rt["controller"].active_flow_l_min})


@websocket_api.websocket_command({vol.Required("type"): "irrigaha/runtime"})
@websocket_api.async_response
async def ws_runtime(hass, connection, msg):
    rt = _runtime(hass); today = dt_util.now().date().isoformat()
    committed = sum(float(item.get("liters", 0) or 0) for item in rt["store"].data.get("water_ledger", []) if str(item.get("timestamp", "")).startswith(today))
    connection.send_result(msg["id"], {"running": rt["controller"].running, "active_zone": rt["controller"].active_zone, "active_started_at": rt["controller"].active_started_at, "active_flow_l_min": rt["controller"].active_flow_l_min, "committed_today_liters": round(committed, 3)})


@websocket_api.websocket_command({vol.Required("type"): "irrigaha/legacy_get"})
@websocket_api.async_response
async def ws_legacy_get(hass, connection, msg):
    rt = _runtime(hass)
    connection.send_result(msg["id"], {
        "state": rt["store"].legacy_state(),
        "revision": rt["store"].data.get("ui_revision", 0),
        "automation": {
            "plans": rt["store"].data.get("plans", {}),
            "last_evaluation": rt["store"].data.get("last_evaluation", ""),
            "last_irrigation": rt["store"].data.get("last_irrigation", {}),
        },
    })


@websocket_api.websocket_command({vol.Required("type"): "irrigaha/legacy_save", vol.Required("payload"): dict})
@websocket_api.async_response
async def ws_legacy_save(hass, connection, msg):
    try:
        rt = _runtime(hass)
        project = msg["payload"].get("state", {})
        sync_warning = None
        async with rt["save_lock"]:
            # The raw project is the authoritative copy and is committed first.
            data = await rt["store"].async_checkpoint_legacy(project)
            try:
                data = await rt["store"].async_save_legacy(project)
            except Exception as err:  # project is already safe on disk
                sync_warning = f"Progetto salvato, sincronizzazione automatismo fallita: {err}"
                rt["store"].data["ui_sync_error"] = str(err)
                await rt["store"].async_save()
                data = rt["store"].data
        rt["catalog"].update({plant["id"]: plant for plant in data.get("custom_plants", []) if plant.get("id")})
        saved = data.get("ui_state", {})
        connection.send_result(msg["id"], {
            "ok": True,
            "revision": data.get("ui_revision", 0),
            "warning": sync_warning,
            "counts": {
                "zones": len(saved.get("zones", [])),
                "areas": len(saved.get("areas", [])),
                "sprinklers": len(saved.get("sprinklers", [])),
                "driplines": len(saved.get("driplines", [])),
                "decor": len(saved.get("decor", [])),
            },
        })
        if not sync_warning:
            rt["coordinator"].async_reschedule()
            rt["coordinator"].async_set_updated_data(rt["coordinator"]._snapshot())
    except Exception as err:
        connection.send_error(msg["id"], "save_failed", f"Salvataggio IRRIGAZIONE SMART fallito: {err}")


@websocket_api.websocket_command({vol.Required("type"): "irrigaha/save", vol.Required("config"): dict})
@websocket_api.async_response
async def ws_save(hass, connection, msg):
    connection.require_admin()
    rt = _runtime(hass)
    old_zone_ids = {zone.get("id") for zone in rt["store"].data.get("zones", [])}
    await rt["store"].async_replace(msg["config"])
    new_zone_ids = {zone.get("id") for zone in rt["store"].data.get("zones", [])}
    needs_reload = old_zone_ids != new_zone_ids
    connection.send_result(msg["id"], {"ok": True, "reloading": needs_reload})
    if needs_reload:
        hass.async_create_task(hass.config_entries.async_reload(rt["entry_id"]))
        return
    rt["coordinator"].async_reschedule()
    await rt["coordinator"].async_evaluate()


@websocket_api.websocket_command({vol.Required("type"): "irrigaha/import_v1", vol.Required("payload"): dict})
@websocket_api.async_response
async def ws_import(hass, connection, msg):
    connection.require_admin()
    rt = _runtime(hass)
    data = await rt["store"].async_import_v1(msg["payload"])
    connection.send_result(msg["id"], {"ok": True, "zones": len(data["zones"]), "reloading": True})
    hass.async_create_task(hass.config_entries.async_reload(rt["entry_id"]))


@websocket_api.websocket_command({vol.Required("type"): "irrigaha/recalculate"})
@websocket_api.async_response
async def ws_recalculate(hass, connection, msg):
    plans = await _runtime(hass)["coordinator"].async_evaluate("manual_ui"); connection.send_result(msg["id"], plans)


@websocket_api.websocket_command({vol.Required("type"): "irrigaha/start_zone", vol.Required("zone_id"): str, vol.Optional("minutes", default=1440): vol.Coerce(float), vol.Optional("source", default="manual_ui"): str})
@websocket_api.async_response
async def ws_start_zone(hass, connection, msg):
    rt = _runtime(hass)
    zone = next((item for item in rt["store"].data.get("zones", []) if item.get("id") == msg["zone_id"]), None)
    if not zone:
        connection.send_error(msg["id"], "zone_not_found", "Zona non trovata"); return
    try:
        rt["controller"].start_background(zone, max(.01, msg["minutes"]), msg["source"])
    except RuntimeError as err:
        connection.send_error(msg["id"], "already_running", str(err)); return
    connection.send_result(msg["id"], {"ok": True, "zone_id": zone["id"]})


@websocket_api.websocket_command({vol.Required("type"): "irrigaha/clear_logs", vol.Required("log_type"): vol.In(("operation", "evaluation"))})
@websocket_api.async_response
async def ws_clear_logs(hass, connection, msg):
    connection.require_admin()
    rt = _runtime(hass); key = "operation_log" if msg["log_type"] == "operation" else "evaluation_log"
    removed = len(rt["store"].data.get(key, [])); rt["store"].data[key] = []; await rt["store"].async_save()
    connection.send_result(msg["id"], {"ok": True, "removed": removed})


@websocket_api.websocket_command({vol.Required("type"): "irrigaha/stop_all"})
@websocket_api.async_response
async def ws_stop(hass, connection, msg):
    await _runtime(hass)["controller"].async_stop_all(); connection.send_result(msg["id"], {"ok": True})


def async_register_websocket(hass):
    if hass.data[DOMAIN].get("websocket_registered"): return
    for command in (ws_get, ws_runtime, ws_legacy_get, ws_legacy_save, ws_save, ws_import, ws_recalculate, ws_start_zone, ws_stop, ws_clear_logs): websocket_api.async_register_command(hass, command)
    hass.data[DOMAIN]["websocket_registered"] = True
