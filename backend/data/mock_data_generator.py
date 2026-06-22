import json
import random
from datetime import datetime, timedelta

from models import Anomaly, Booking, KpiHistory, Recommendation, Resource, Occupancy

FLOORS = [f"Floor {i}" for i in range(1, 9)]

ROOMS_BY_FLOOR = {
    floor: [f"{floor.replace('Floor ', 'F')}-Room {letter}" for letter in ["A", "B", "C", "D"][: 2 if i % 2 == 0 else 3]]
    for i, floor in enumerate(FLOORS, start=1)
}

ROOM_CAPACITY = {
    "F1-Room A": 15, "F1-Room B": 20, "F1-Room C": 12,
    "F2-Room A": 10, "F2-Room B": 8,
    "F3-Room A": 25, "F3-Room B": 18, "F3-Room C": 15,
    "F4-Room A": 12, "F4-Room B": 10,
    "F5-Room A": 30, "F5-Room B": 20, "F5-Room C": 15,
    "F6-Room A": 8, "F6-Room B": 6,
    "F7-Room A": 20, "F7-Room B": 15, "F7-Room C": 12,
    "F8-Room A": 10, "F8-Room B": 8,
}

ELECTRICITY_RATE = 0.51  # RM per kWh
WATER_RATE = 0.0085  # RM per liter
CARBON_PER_KWH = 0.584  # kg CO2 per kWh (Malaysia grid average)

random.seed(42)


def _business_hour_factor(hour, weekday):
    if weekday >= 5:  # weekend
        if 9 <= hour <= 18:
            return 0.3
        elif 7 <= hour < 9 or 18 < hour <= 20:
            return 0.2
        return 0.15
    else:  # weekday
        if 9 <= hour <= 18:
            return 1.0
        elif 7 <= hour < 9:
            return 0.6
        elif 18 < hour <= 20:
            return 0.5
        elif 20 < hour <= 22:
            return 0.3
        else:
            return 0.15


def generate_occupancy(days=30):
    """Generate occupancy data - called ONCE and passed to resources"""
    rows = []
    end = datetime.utcnow().replace(minute=0, second=0, microsecond=0)
    start = end - timedelta(days=days)
    
    floor_occupancy_base = {
        "Floor 1": 0.8, "Floor 2": 0.6, "Floor 3": 0.7,
        "Floor 4": 0.9, "Floor 5": 0.5, "Floor 6": 0.4,
        "Floor 7": 0.7, "Floor 8": 0.3,
    }
    
    current = start
    while current < end:
        hour = current.hour
        weekday = current.weekday()
        factor = _business_hour_factor(hour, weekday)
        
        is_special = False
        if current.weekday() == 2 and 14 <= hour <= 16:
            is_special = True
        
        for floor in FLOORS:
            base_rate = floor_occupancy_base.get(floor, 0.6)
            
            if is_special and floor in ["Floor 3", "Floor 4"]:
                occupancy_rate = min(95, base_rate * factor * 100 * random.uniform(1.2, 1.5))
            else:
                occupancy_rate = min(95, base_rate * factor * 100 * random.uniform(0.85, 1.15))
            
            occupancy_rate = max(0, min(95, occupancy_rate))
            
            rooms = ROOMS_BY_FLOOR.get(floor, [])
            total_capacity = sum(ROOM_CAPACITY.get(room, 10) for room in rooms)
            occupancy_count = int((occupancy_rate / 100) * total_capacity * random.uniform(0.7, 1.3))
            occupancy_count = min(occupancy_count, total_capacity)
            
            source = random.choices(
                ["sensor", "booking", "wifi", "estimated"],
                weights=[0.4, 0.3, 0.2, 0.1]
            )[0]
            
            rows.append(
                Occupancy(
                    floor=floor,
                    room=None,
                    occupancy_count=occupancy_count,
                    occupancy_rate=round(occupancy_rate, 2),
                    timestamp=current,
                    source=source,
                    confidence=round(random.uniform(70, 95), 2),
                )
            )
            
            # Room-level occupancy
            if random.random() < 0.3:
                for room in random.sample(rooms, min(2, len(rooms))):
                    room_capacity = ROOM_CAPACITY.get(room, 10)
                    room_occupancy = int((occupancy_rate / 100) * room_capacity * random.uniform(0.5, 1.2))
                    room_occupancy = min(room_occupancy, room_capacity)
                    
                    rows.append(
                        Occupancy(
                            floor=floor,
                            room=room,
                            occupancy_count=room_occupancy,
                            occupancy_rate=round((room_occupancy / room_capacity) * 100, 2),
                            timestamp=current,
                            source=source,
                            confidence=round(random.uniform(75, 92), 2),
                        )
                    )
        
        current += timedelta(hours=1)
    
    return rows


def generate_resources(occupancy_data, days=30):
    """Generate resources using pre-generated occupancy data"""
    rows = []
    end = datetime.utcnow().replace(minute=0, second=0, microsecond=0)
    start = end - timedelta(days=days)

    floor_base = {floor: random.uniform(0.85, 1.25) for floor in FLOORS}
    
    # Create lookup for occupancy by timestamp and floor
    occupancy_lookup = {}
    for occ in occupancy_data:
        key = (occ.timestamp, occ.floor)
        occupancy_lookup[key] = occ

    current = start
    while current < end:
        hour = current.hour
        weekday = current.weekday()
        factor = _business_hour_factor(hour, weekday)

        for floor in FLOORS:
            fbase = floor_base[floor]
            
            # Get occupancy for this floor/time
            occ_key = (current, floor)
            occupancy = occupancy_lookup.get(occ_key)
            
            if occupancy:
                occ_rate = float(occupancy.occupancy_rate) / 100
                occ_count = occupancy.occupancy_count
                occupancy_multiplier = 0.3 + (0.7 * occ_rate)
            else:
                occ_rate = 0.0
                occ_count = 0
                occupancy_multiplier = factor
            
            # Electricity
            base_electricity = 15 * factor * fbase
            occupancy_electricity = 35 * occupancy_multiplier * fbase
            elec_value = round(base_electricity + occupancy_electricity + random.uniform(-2, 2), 2)
            elec_value = max(5, min(80, elec_value))
            
            # Water
            water_value = round(
                max(
                    5,
                    200 * occupancy_multiplier * random.uniform(0.7, 1.3)
                ),
                2
            )

            # ---------------------------------
            # AI anomaly injection
            # ---------------------------------

            if random.random() < 0.01:

                # Energy anomaly
                if random.random() < 0.7:

                    elec_value *= random.uniform(
                        2.0,
                        4.0
                    )

                # Water anomaly
                else:

                    water_value *= random.uniform(
                        2.0,
                        5.0
                    )

            # Carbon emission
            carbon_emission = round(
                elec_value * CARBON_PER_KWH,
                2
            )

            # Create resource with direct occupancy snapshot
            rows.append(
                Resource(
                    floor=floor,
                    room=None,
                    resource_type="electricity",
                    value=elec_value,
                    cost=round(elec_value * ELECTRICITY_RATE, 2),
                    occupancy_count=occ_count,
                    occupancy_rate=round(occ_rate * 100, 2),
                    carbon_emission=carbon_emission,
                    timestamp=current,
                )
            )
            
            rows.append(
                Resource(
                    floor=floor,
                    room=None,
                    resource_type="water",
                    value=water_value,
                    cost=round(water_value * WATER_RATE, 2),
                    occupancy_count=occ_count,
                    occupancy_rate=round(occ_rate * 100, 2),
                    carbon_emission=0,  # Water carbon is negligible
                    timestamp=current,
                )
            )

        current += timedelta(hours=1)

    return rows


def generate_bookings(days=7):
    """Generate bookings with expected occupants"""
    rows = []
    end = datetime.utcnow().replace(minute=0, second=0, microsecond=0)
    start = end - timedelta(days=days)

    booked_by_pool = [
        "Alice Tan", "Marcus Lee", "Priya Raj", "John Lim", "Siti Aishah",
        "David Wong", "Nurul Huda", "Kevin Chong", "Farah Aziz", "Brandon Goh",
        "Sarah Chen", "Raj Kumar", "Emily Wong", "Ahmad Faiz", "Megan Lee",
    ]
    status_pool = ["booked"] * 5 + ["completed"] * 3 + ["cancelled"] * 2
    meeting_types = ["team_meeting", "client_presentation", "workshop", "interview", "training"]

    current = start
    while current < end:
        bookings_today = random.randint(8, 15)
        for _ in range(bookings_today):
            floor = random.choice(FLOORS)
            rooms = ROOMS_BY_FLOOR.get(floor, ["F1-Room A"])
            room = random.choice(rooms)
            
            start_hour = random.randint(8, 17)
            duration = random.choice([1, 1, 2, 0.5])
            start_time = current.replace(hour=start_hour, minute=0)
            end_time = start_time + timedelta(hours=duration)
            
            capacity = ROOM_CAPACITY.get(room, 10)
            meeting_type = random.choice(meeting_types)
            
            if meeting_type in ["client_presentation", "workshop"]:
                expected = random.randint(5, min(capacity, 15))
            elif meeting_type == "training":
                expected = random.randint(3, min(capacity, 10))
            elif meeting_type == "team_meeting":
                expected = random.randint(2, min(capacity, 8))
            else:
                expected = random.randint(1, 3)
            
            rows.append(
                Booking(
                    floor=floor,
                    room_name=room,
                    booked_by=random.choice(booked_by_pool),
                    start_time=start_time,
                    end_time=end_time,
                    status=random.choice(status_pool),
                    created_at=start_time - timedelta(days=random.randint(0, 5)),
                    expected_occupants=expected,
                )
            )
        current += timedelta(days=1)

    return rows


def generate_recommendations():
    """Generate recommendations with occupancy-based flag"""
    now = datetime.utcnow()
    specs = [
        dict(title="Reduce HVAC runtime by 1 hour", category="electricity",
             description="Set HVAC to shut down 1 hour earlier based on occupancy patterns.",
             savings=2800, confidence=92, carbon=450, equivalent="22 mature trees", occupancy_based=True),
        dict(title="Optimize chiller setpoint", category="electricity",
             description="Raise chiller setpoint by 1.5°C during low occupancy (<30%).",
             savings=1600, confidence=85, carbon=260, equivalent="13 mature trees", occupancy_based=True),
        dict(title="Switch common areas to motion-sensor lighting", category="electricity",
             description="Install motion sensors based on occupancy data.",
             savings=950, confidence=88, carbon=150, equivalent="7.5 mature trees", occupancy_based=True),
        dict(title="Repair Floor 5 restroom leak", category="water",
             description="Fix pipe leak flagged by anomaly detection.",
             savings=1200, confidence=95, carbon=80, equivalent="0.8 smartphones", occupancy_based=False),
        dict(title="Install low-flow fixtures", category="water",
             description="Replace existing taps with low-flow fixtures.",
             savings=600, confidence=80, carbon=40, equivalent="0.4 smartphones", occupancy_based=False),
        dict(title="Consolidate low-occupancy floors on Fridays", category="space",
             description="Merge Friday bookings based on occupancy data.",
             savings=2100, confidence=78, carbon=320, equivalent="16 mature trees", occupancy_based=True),
        dict(title="Repurpose underused Floor 6 rooms", category="space",
             description="Convert rooms with <30% occupancy to hot-desking.",
             savings=700, confidence=70, carbon=90, equivalent="4.5 trees", occupancy_based=True),
        dict(title="Adjust janitorial shift coverage", category="manpower",
             description="Reduce hours on low-occupancy floors.",
             savings=480, confidence=82, carbon=0, equivalent="N/A", occupancy_based=True),
        dict(title="Dynamic lighting based on occupancy", category="electricity",
             description="Zone-based lighting that adjusts to real-time occupancy.",
             savings=1500, confidence=90, carbon=240, equivalent="12 trees", occupancy_based=True),
    ]

    rows = []
    for spec in specs:
        rows.append(
            Recommendation(
                title=spec["title"],
                description=spec["description"],
                category=spec["category"],
                estimated_savings=spec["savings"],
                confidence_score=spec["confidence"],
                carbon_impact=spec["carbon"],
                carbon_equivalent=spec["equivalent"],
                implemented=random.random() < 0.15,
                created_at=now - timedelta(days=random.randint(0, 14)),
                implemented_at=now - timedelta(days=random.randint(0, 3)) if random.random() < 0.15 else None,
                occupancy_based=spec["occupancy_based"],
            )
        )
    return rows


def generate_kpi_history(months=6):
    """Generate KPI history with occupancy metrics"""
    rows = []
    today = datetime.utcnow().date().replace(day=1)
    energy = 70
    carbon = 65
    resource = 68
    occupancy = 65

    for i in range(months - 1, -1, -1):
        month_date = _months_ago(today, i)
        
        energy = max(50, min(98, energy + random.randint(-2, 5)))
        carbon = max(50, min(98, carbon + random.randint(-2, 4)))
        resource = max(50, min(98, resource + random.randint(-2, 4)))
        efficiency = round((energy + carbon + resource) / 3)
        
        occupancy = max(40, min(90, occupancy + random.randint(-3, 4)))
        occupancy_efficiency = round((100 - efficiency) * (occupancy / 100) * random.uniform(0.8, 1.2), 2)

        rows.append(
            KpiHistory(
                month=month_date,
                efficiency_score=efficiency,
                energy_score=energy,
                carbon_score=carbon,
                resource_score=resource,
                carbon_footprint=round(random.uniform(20, 35), 2),
                total_savings=round(random.uniform(15000, 32000), 2),
                cost_reduction=round(random.uniform(2, 15), 2),
                avg_occupancy_rate=round(occupancy, 2),
                peak_occupancy=random.randint(85, 98),
                occupancy_efficiency=occupancy_efficiency,
            )
        )

    rows.sort(key=lambda r: r.month)
    return rows


def _months_ago(date, n):
    month_index = date.month - 1 - n
    year = date.year + month_index // 12
    month = month_index % 12 + 1
    day = min(date.day, [31, 29 if year % 4 == 0 else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1])
    return date.replace(year=year, month=month, day=day)