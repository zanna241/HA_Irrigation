"""Persistent storage and migration for IRRIGAZIONE SMART."""
from __future__ import annotations
from copy import deepcopy
from datetime import datetime
from homeassistant.helpers.storage import Store
from .const import DEFAULT_CONFIG, STORAGE_KEY, STORAGE_VERSION


class IrrigationSmartStore:
    def __init__(self, hass):
        self._store = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        self.data = deepcopy(DEFAULT_CONFIG)

    async def async_load(self):
        saved = await self._store.async_load() or {}
        self.data = _deep_merge(deepcopy(DEFAULT_CONFIG), saved)
        for item in self.data.get("water_ledger", []):
            if "timestamp" not in item and item.get("ts") is not None:
                try: item["timestamp"] = datetime.fromtimestamp(float(item["ts"]) / 1000).astimezone().isoformat()
                except (TypeError, ValueError, OSError): pass
            if "zone_id" not in item and item.get("zoneId") is not None: item["zone_id"] = item["zoneId"]
        return self.data

    async def async_save(self):
        await self._store.async_save(self.data)

    async def async_replace(self, data, *, preserve_logs=True):
        """Replace configuration without treating a settings save as log deletion."""
        operation_log = deepcopy(self.data.get("operation_log", []))
        evaluation_log = deepcopy(self.data.get("evaluation_log", []))
        self.data = _deep_merge(deepcopy(DEFAULT_CONFIG), data)
        if preserve_logs:
            self.data["operation_log"] = operation_log
            self.data["evaluation_log"] = evaluation_log
        await self.async_save()
        return self.data

    async def async_import_v1(self, payload):
        old = payload.get("state", payload)
        await self.async_checkpoint_legacy(old)
        return await self.async_save_legacy(old)

    async def async_checkpoint_legacy(self, old):
        """Persist the untouched project before any native conversion."""
        self.data["ui_state"] = deepcopy(old)
        self.data["ui_revision"] = int(self.data.get("ui_revision", 0)) + 1
        self.data.pop("ui_sync_error", None)
        await self.async_save()
        return self.data

    async def async_save_legacy(self, old):
        """Persist the complete 1.5 UI model and synchronize native fields."""
        zones = []
        for zone in old.get("zones", []):
            zones.append({
                "id": zone.get("id"), "name": zone.get("name", "Zona"),
                "valve_entity": zone.get("relayEntity", ""), "pressure_bar": zone.get("pressureBar", 3),
                "plant_profile_id": zone.get("plantProfileId", "grass-cool"),
                "maintenance": bool(zone.get("maintenance", False)),
                "area_m2": zone.get("areaM2", 50), "efficiency": zone.get("irrigationEfficiency", .75),
                "exposure": zone.get("exposure", 1), "density": zone.get("density", 1),
                "establishment": zone.get("establishment", 1),
                "flow_l_min": _zone_flow(old, zone.get("id")),
                "soil_sensor": _zone_soil_sensor(old, zone.get("id")),
            })
        migrated = {
            "enabled": old.get("auto", {}).get("enabled", False),
            "pump_entity": old.get("pump", {}).get("relayEntity", ""),
            "flow_sensor": old.get("pump", {}).get("flowSensorEntity", ""),
            "max_pump_runtime_minutes": max(1, float(old.get("pump", {}).get("maxRuntimeMinutes", 120) or 120)),
            "stop_on_no_flow": bool(old.get("pump", {}).get("stopOnNoFlow", False)),
            "stop_when_all_valves_closed": bool(old.get("pump", {}).get("stopWhenAllValvesClosed", False)),
            "weather_entity": old.get("auto", {}).get("weatherEntity", ""),
            "rain_sensor": old.get("auto", {}).get("rainSensor", ""),
            "check_times": old.get("auto", {}).get("checkTimes", ["05:00", "14:00", "21:00"]),
            "start_time": old.get("auto", {}).get("startTime", "06:00"),
            "active_weekdays": [
                index + 1 for index, day in enumerate(("lun", "mar", "mer", "gio", "ven", "sab", "dom"))
                if old.get("auto", {}).get("days", {}).get(day, True)
            ],
            "manual_schedules": [
                {
                    "zone_id": zone_id,
                    "enabled": bool(schedule.get("enabled", False)),
                    "minutes": max(1, int(schedule.get("minutes", old.get("timers", {}).get(zone_id, 10)) or 10)),
                    "start_time": schedule.get("startTime", "06:00"),
                    "weekdays": [
                        index + 1 for index, day in enumerate(("lun", "mar", "mer", "gio", "ven", "sab", "dom"))
                        if schedule.get("days", {}).get(day, True)
                    ],
                }
                for zone_id, schedule in (old.get("manualSchedules") or {}).items()
            ],
            "valve_pump_delay": old.get("pump", {}).get("valvePumpDelaySec", 2),
            "rain_probability_threshold": old.get("auto", {}).get("rainThreshold", 60),
            "eto_fallback_mm": old.get("auto", {}).get("etoFallback", 4),
            "effective_rain_mm": old.get("auto", {}).get("effectiveRainMm", 0),
            "zones": zones,
            "map": {"width_m": old.get("plot", {}).get("widthM", 50), "height_m": old.get("plot", {}).get("heightM", 31), "areas": old.get("areas", []), "devices": old.get("sprinklers", []) + old.get("driplines", []) + old.get("decor", [])},
            "custom_plants": [_native_plant(p) for p in old.get("customPlants", [])],
            "water_ledger": deepcopy(self.data.get("water_ledger") or old.get("waterLedger", [])),
            "operation_log": deepcopy(self.data.get("operation_log", [])),
            "evaluation_log": deepcopy(self.data.get("evaluation_log", [])),
            "ui_state": old,
            "ui_revision": int(self.data.get("ui_revision", 0)),
        }
        # Preserve backend plans and execution history while the UI is edited.
        migrated["plans"] = self.data.get("plans", {})
        migrated["last_irrigation"] = self.data.get("last_irrigation", {})
        # I registri backend sono autorevoli e non devono essere cancellati da
        # un salvataggio del progetto grafico proveniente dal frontend.
        migrated["operation_log"] = deepcopy(self.data.get("operation_log", []))
        migrated["evaluation_log"] = deepcopy(self.data.get("evaluation_log", []))
        return await self.async_replace(migrated)

    def legacy_state(self):
        """Return the full 1.5 model, seeding it from native config if needed."""
        old = deepcopy(self.data.get("ui_state") or {})
        old.setdefault("pump", {})
        old["pump"].setdefault("relayEntity", self.data.get("pump_entity", ""))
        old["pump"].setdefault("flowSensorEntity", self.data.get("flow_sensor", ""))
        old["pump"].setdefault("maxRuntimeMinutes", self.data.get("max_pump_runtime_minutes", 120))
        old["pump"].setdefault("stopOnNoFlow", self.data.get("stop_on_no_flow", False))
        old["pump"].setdefault("stopWhenAllValvesClosed", self.data.get("stop_when_all_valves_closed", False))
        old["pump"].setdefault("valvePumpDelaySec", self.data.get("valve_pump_delay", 2))
        old.setdefault("auto", {})
        old["auto"].setdefault("enabled", self.data.get("enabled", True))
        old["auto"].setdefault("weatherEntity", self.data.get("weather_entity", ""))
        old["auto"].setdefault("rainSensor", self.data.get("rain_sensor", ""))
        old["auto"].setdefault("checkTimes", self.data.get("check_times", []))
        old["auto"].setdefault("startTime", self.data.get("start_time", "06:00"))
        if not old.get("zones") and self.data.get("zones"):
            old["zones"] = [_legacy_zone(zone) for zone in self.data["zones"]]
        return old


def _deep_merge(base, extra):
    for key, value in extra.items():
        if isinstance(value, dict) and isinstance(base.get(key), dict):
            _deep_merge(base[key], value)
        else:
            base[key] = value
    return base


def _zone_flow(old, zone_id):
    zone = next((item for item in old.get("zones", []) if item.get("id") == zone_id), None)
    if zone and zone.get("calculatedFlowLmin") is not None:
        return max(float(zone["calculatedFlowLmin"]), .01)
    total = 0.0
    for item in old.get("sprinklers", []):
        if item.get("zoneId") == zone_id:
            model_flow = float(item.get("customFlow360") or 0)
            if item.get("type") == "drip":
                model_flow = float(item.get("numEmitters") or 1) * float(item.get("flowPerEmitterLh") or 4) / 60
            total += model_flow
    meters_per_pixel = max(.0001, float(old.get("metersPerPixel") or .05))
    for line in old.get("driplines", []):
        if line.get("zoneId") != zone_id:
            continue
        points = line.get("points", [])
        length_px = sum(
            ((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2) ** .5
            for a, b in zip(points, points[1:])
        )
        # The exact model value remains available in ui_state; use a safe
        # default when synchronizing the backend plan.
        total += length_px * meters_per_pixel * float(line.get("flowPerMeterLh") or 6) / 60
    return max(total, 1.0)


def _zone_soil_sensor(old, zone_id):
    for sensor in old.get("sensors", []):
        if sensor.get("kind") == "umidita_suolo" and sensor.get("affectsZoneId") == zone_id:
            return sensor.get("entityId", "")
    return ""


def _native_plant(plant):
    return {
        "id": plant.get("id"), "category": plant.get("category", "Personalizzata"),
        "name": plant.get("name", "Pianta"), "scientific": plant.get("scientific", ""),
        "kc": plant.get("kc", .55), "root_depth": plant.get("rootDepth", .5),
        "target_moisture": plant.get("targetMoisture", 50),
        "source": plant.get("source", "Personalizzato"), "confidence": plant.get("confidence", "D"),
    }


def _legacy_zone(zone):
    return {
        "id": zone.get("id"), "name": zone.get("name", "Zona"),
        "relayEntity": zone.get("valve_entity", ""), "pressureBar": zone.get("pressure_bar", 3),
        "plantProfileId": zone.get("plant_profile_id", "grass-cool"),
        "maintenance": bool(zone.get("maintenance", False)),
        "areaM2": zone.get("area_m2", 50), "irrigationEfficiency": zone.get("efficiency", .75),
        "exposure": zone.get("exposure", 1), "density": zone.get("density", 1),
        "establishment": zone.get("establishment", 1),
    }
