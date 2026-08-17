"""Scheduler, planning and execution coordinator."""
from __future__ import annotations
from datetime import datetime, timedelta
from uuid import uuid4
from functools import partial
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator
from homeassistant.helpers.event import async_track_time_change
from homeassistant.util import dt as dt_util

from .water_balance import calculate_zone


class IrrigationSmartCoordinator(DataUpdateCoordinator):
    def __init__(self, hass, store, controller, catalog):
        super().__init__(hass, logger=__import__("logging").getLogger(__name__), name="IRRIGAZIONE SMART")
        self.store, self.controller, self.catalog = store, controller, catalog
        self._unsubs = []
        self.data = self._snapshot()

    def _snapshot(self):
        return {**self.store.data, "running": self.controller.running, "active_zone": self.controller.active_zone}

    async def async_start(self):
        await self.controller.async_startup_safe_state()
        self.async_reschedule()
        await self.async_evaluate("startup")

    def async_reschedule(self):
        for unsub in self._unsubs: unsub()
        self._unsubs.clear()
        for value in self.store.data.get("check_times", []):
            try: hour, minute = map(int, value.split(":"))
            except (ValueError, AttributeError): continue
            self._unsubs.append(async_track_time_change(self.hass, self._scheduled_check, hour=hour, minute=minute, second=0))
        try: hour, minute = map(int, self.store.data.get("start_time", "06:00").split(":"))
        except ValueError: hour, minute = 6, 0
        self._unsubs.append(async_track_time_change(self.hass, self._scheduled_execute, hour=hour, minute=minute, second=0))
        for schedule in self.store.data.get("manual_schedules", []):
            if not schedule.get("enabled"):
                continue
            try: hour, minute = map(int, schedule.get("start_time", "06:00").split(":"))
            except (ValueError, AttributeError): continue
            self._unsubs.append(async_track_time_change(
                self.hass, partial(self._scheduled_manual, schedule=schedule),
                hour=hour, minute=minute, second=0,
            ))

    async def _scheduled_check(self, _now): await self.async_evaluate("scheduled_check")
    async def _scheduled_execute(self, now):
        await self.async_evaluate("scheduled_execution")
        if now.isoweekday() in self.store.data.get("active_weekdays", []):
            await self.async_execute_plan()

    async def _scheduled_manual(self, now, schedule):
        if now.isoweekday() not in schedule.get("weekdays", []):
            return
        zone = next((item for item in self.store.data.get("zones", []) if item.get("id") == schedule.get("zone_id")), None)
        if zone and not zone.get("maintenance"):
            await self.controller.async_run_zone(zone, max(1, float(schedule.get("minutes", 10))), "scheduled_manual")
            self.async_set_updated_data(self._snapshot())

    async def _forecast(self):
        entity = self.store.data.get("weather_entity")
        state = self.hass.states.get(entity) if entity else None
        temp = float((state.attributes.get("temperature", 20) if state else 20) or 20)
        humidity = float((state.attributes.get("humidity", 50) if state else 50) or 50)
        rain_probability = float((state.attributes.get("precipitation_probability", 0) if state else 0) or 0)
        try:
            response = await self.hass.services.async_call("weather", "get_forecasts", {"type": "daily", "entity_id": entity}, blocking=True, return_response=True)
            forecast = response.get(entity, {}).get("forecast", [])
            if forecast: rain_probability = float(forecast[0].get("precipitation_probability") or 0)
        except Exception:  # provider may not expose forecasts
            pass
        return temp, humidity, rain_probability

    async def async_evaluate(self, source="manual"):
        temp, humidity, rain_probability = await self._forecast()
        factor = max(.4, min(1.6, 1 + (temp - 22) / 40 - (humidity - 50) / 200))
        eto = float(self.store.data.get("eto_fallback_mm", 4)) * factor
        plans = {}
        raining = bool(self.store.data.get("rain_sensor") and self.hass.states.is_state(self.store.data["rain_sensor"], "on"))
        for zone in self.store.data.get("zones", []):
            plant = self.catalog.get(zone.get("plant_profile_id"), self.catalog["grass-cool"])
            soil_state = self.hass.states.get(zone.get("soil_sensor")) if zone.get("soil_sensor") else None
            try: soil = float(soil_state.state) if soil_state else None
            except (TypeError, ValueError): soil = None
            plan = calculate_zone(zone, plant, eto, self.store.data.get("effective_rain_mm", 0), soil)
            if zone.get("maintenance"):
                plan.update({"minutes": 0, "liters": 0, "net_mm": 0, "blocked_reason": "maintenance"})
            elif raining or rain_probability >= self.store.data.get("rain_probability_threshold", 60):
                plan.update({"minutes": 0, "liters": 0, "net_mm": 0, "blocked_reason": "rain"})
            plans[zone["id"]] = plan
        self.store.data["plans"] = plans
        self.store.data["last_evaluation"] = dt_util.now().isoformat()
        log = self.store.data.setdefault("evaluation_log", [])
        log.append({
            "id": uuid4().hex,
            "timestamp": self.store.data["last_evaluation"],
            "source": source,
            "temperature": round(temp, 1),
            "humidity": round(humidity, 1),
            "rain_probability": round(rain_probability, 1),
            "raining": raining,
            "plans": {
                zone_id: {
                    "minutes": value.get("minutes", 0),
                    "liters": value.get("liters", 0),
                    "blocked_reason": value.get("blocked_reason", ""),
                    "soil_moisture": value.get("soil_moisture"),
                } for zone_id, value in plans.items()
            },
        })
        cutoff = dt_util.now() - timedelta(days=90)
        def recent(item):
            try: return dt_util.parse_datetime(item.get("timestamp", "")) >= cutoff
            except (TypeError, ValueError): return False
        self.store.data["evaluation_log"] = [item for item in log if recent(item)]
        await self.store.async_save(); self.async_set_updated_data(self._snapshot())
        return plans

    async def async_execute_plan(self):
        if not self.store.data.get("enabled", True): return
        today = dt_util.now().date().isoformat()
        for zone in self.store.data.get("zones", []):
            plan = self.store.data.get("plans", {}).get(zone["id"], {})
            last = self.store.data.get("last_irrigation", {}).get(zone["id"], "")
            if not zone.get("maintenance") and plan.get("minutes", 0) > 0 and not last.startswith(today):
                await self.controller.async_run_zone(zone, plan["minutes"], "automatic")
                self.async_set_updated_data(self._snapshot())

    async def async_shutdown(self):
        for unsub in self._unsubs: unsub()
        await self.controller.async_stop_all()
