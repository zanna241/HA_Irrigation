"""Single safe state machine for every hydraulic command."""
from __future__ import annotations
import asyncio
from datetime import datetime
from uuid import uuid4


class HydraulicController:
    def __init__(self, hass, store):
        self.hass, self.store = hass, store
        self.lock = asyncio.Lock()
        self.active_zone = None
        self.running = False
        self.abort = asyncio.Event()
        self.task = None
        self.active_started_at = None
        self.active_flow_l_min = 0.0

    def _log(self, event, *, zone=None, source="system", liters=None, minutes=None, detail=""):
        item = {
            "id": uuid4().hex,
            "timestamp": datetime.now().astimezone().isoformat(),
            "event": event,
            "source": source,
            "detail": detail,
        }
        if zone:
            item.update({"zone_id": zone.get("id"), "zone_name": zone.get("name", "Zona")})
        if liters is not None: item["liters"] = round(float(liters), 2)
        if minutes is not None: item["minutes"] = round(float(minutes), 3)
        self.store.data.setdefault("operation_log", []).append(item)
        return item

    async def _switch(self, entity_id, on):
        if not entity_id:
            raise ValueError("Entità non configurata")
        await self.hass.services.async_call("homeassistant", "turn_on" if on else "turn_off", {"entity_id": entity_id}, blocking=True)

    async def async_run_zone(self, zone, minutes, source="automatic"):
        async with self.lock:
            self.abort.clear(); self.running = True; self.active_zone = zone["id"]
            delay = max(0, float(self.store.data.get("valve_pump_delay", 2)))
            pump = self.store.data.get("pump_entity", "")
            started = datetime.now().astimezone()
            pumping_started = started; measured_liters = 0.0; has_measurement = False
            self.active_flow_l_min = float(zone.get("flow_l_min", 0) or 0)
            self._log("zone_start_requested", zone=zone, source=source, detail=f"Durata richiesta: {float(minutes):.2f} min")
            await self.store.async_save()
            try:
                await self._switch(zone.get("valve_entity", ""), True)
                self._log("zone_valve_on", zone=zone, source=source)
                await asyncio.sleep(delay)
                if self.abort.is_set(): return
                await self._switch(pump, True)
                self._log("pump_on", zone=zone, source=source)
                pumping_started = datetime.now().astimezone()
                self.active_started_at = pumping_started.isoformat()
                await self.store.async_save()
                deadline = asyncio.get_running_loop().time() + max(0, float(minutes)) * 60
                previous = asyncio.get_running_loop().time()
                while not self.abort.is_set():
                    remaining = deadline - asyncio.get_running_loop().time()
                    if remaining <= 0: break
                    try: await asyncio.wait_for(self.abort.wait(), timeout=min(1.0, remaining))
                    except TimeoutError: pass
                    now_mono = asyncio.get_running_loop().time(); delta = max(0, now_mono - previous); previous = now_mono
                    sensor_id = self.store.data.get("flow_sensor", "")
                    sensor = self.hass.states.get(sensor_id) if sensor_id else None
                    try: flow = float(sensor.state) if sensor else None
                    except (TypeError, ValueError): flow = None
                    if flow is not None and flow >= 0:
                        self.active_flow_l_min = flow; measured_liters += flow * delta / 60; has_measurement = True
            finally:
                try:
                    await self._switch(pump, False)
                    self._log("pump_off", zone=zone, source=source)
                finally:
                    await asyncio.sleep(delay)
                    await self._switch(zone.get("valve_entity", ""), False)
                    self._log("zone_valve_off", zone=zone, source=source)
                elapsed = max(0, (datetime.now().astimezone() - pumping_started).total_seconds() / 60)
                liters = measured_liters if has_measurement else elapsed * float(zone.get("flow_l_min", 0))
                self.store.data["water_ledger"].append({"timestamp": datetime.now().astimezone().isoformat(), "zone_id": zone["id"], "minutes": round(elapsed, 2), "liters": round(liters, 1), "source": source})
                self._log("zone_cycle_complete", zone=zone, source=source, liters=liters, minutes=elapsed)
                self.store.data["last_irrigation"][zone["id"]] = datetime.now().astimezone().isoformat()
                self.running = False; self.active_zone = None
                self.active_started_at = None; self.active_flow_l_min = 0.0
                await self.store.async_save()

    def start_background(self, zone, minutes, source="manual"):
        if self.task and not self.task.done():
            raise RuntimeError("È già attiva un'irrigazione")
        self.task = self.hass.async_create_task(self.async_run_zone(zone, minutes, source))
        return self.task

    async def async_stop_all(self):
        self.abort.set()
        async with self.lock:
            pump = self.store.data.get("pump_entity", "")
            if pump:
                await self._switch(pump, False)
                self._log("pump_off_emergency", source="stop_all")
            await asyncio.sleep(max(0, float(self.store.data.get("valve_pump_delay", 2))))
            for zone in self.store.data.get("zones", []):
                if zone.get("valve_entity"):
                    await self._switch(zone["valve_entity"], False)
                    self._log("zone_valve_off_emergency", zone=zone, source="stop_all")
            self.running = False; self.active_zone = None
            self.active_started_at = None; self.active_flow_l_min = 0.0
            await self.store.async_save()

    async def async_startup_safe_state(self):
        await self.async_stop_all()
