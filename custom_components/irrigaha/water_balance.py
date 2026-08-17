"""Pure agronomic calculations."""
from __future__ import annotations


def calculate_zone(zone, plant, eto_mm, effective_rain_mm=0, soil_moisture=None):
    target = float(plant.get("target_moisture", 55))
    soil_factor = 1.0 if soil_moisture is None else max(.65, min(1.35, 1 + (target - soil_moisture) / 100))
    coefficient = float(plant.get("kc", .6)) * float(zone.get("exposure", 1)) * float(zone.get("density", 1)) * float(zone.get("establishment", 1)) * soil_factor
    net_mm = max(0.0, float(eto_mm) * coefficient - float(effective_rain_mm))
    area = max(.1, float(zone.get("area_m2", 1)))
    efficiency = max(.2, min(1, float(zone.get("efficiency", .75))))
    liters = net_mm * area / efficiency
    flow = max(.01, float(zone.get("flow_l_min", 0)))
    minutes = min(180.0, liters / flow)
    if soil_moisture is not None and soil_moisture >= target:
        net_mm = liters = minutes = 0.0
    return {"net_mm": round(net_mm, 2), "liters": round(liters, 1), "minutes": round(minutes, 1), "kc_effective": round(coefficient, 3), "soil_moisture": soil_moisture}
