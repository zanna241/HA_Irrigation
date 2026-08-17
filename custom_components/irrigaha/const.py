"""Constants for IRRIGAZIONE SMART."""
DOMAIN = "irrigaha"
PLATFORMS = ["sensor", "binary_sensor", "switch", "button"]
STORAGE_VERSION = 1
STORAGE_KEY = "irrigaha.config"
EVENT_UPDATED = "irrigaha_updated"
SERVICE_RECALCULATE = "recalculate"
SERVICE_START_ZONE = "start_zone"
SERVICE_STOP_ALL = "stop_all"

DEFAULT_CONFIG = {
    "enabled": True,
    "pump_entity": "",
    "flow_sensor": "",
    "max_pump_runtime_minutes": 120.0,
    "stop_on_no_flow": False,
    "stop_when_all_valves_closed": False,
    "weather_entity": "",
    "rain_sensor": "",
    "check_times": ["05:00", "14:00", "21:00"],
    "start_time": "06:00",
    "active_weekdays": [1, 2, 3, 4, 5, 6, 7],
    "manual_schedules": [],
    "valve_pump_delay": 2.0,
    "rain_probability_threshold": 60,
    "eto_fallback_mm": 4.0,
    "effective_rain_mm": 0.0,
    "zones": [],
    "map": {"width_m": 50, "height_m": 31, "areas": [], "devices": []},
    "custom_plants": [],
    "last_evaluation": None,
    "last_irrigation": {},
    "water_ledger": [],
    "operation_log": [],
    "evaluation_log": [],
    "plans": {},
    "ui_state": {},
    "ui_revision": 0,
}
