from datetime import datetime, timedelta

from models import Booking, Resource

LOW_OCCUPANCY_THRESHOLD = 0.40


def get_space_consolidation():

    since = datetime.utcnow() - timedelta(days=14)

    bookings = (
        Booking.query.filter(
            Booking.start_time >= since,
            Booking.status != "cancelled",
        ).all()
    )

    floor_usage = {}

    for booking in bookings:

        floor = booking.floor

        floor_usage[floor] = (
            floor_usage.get(floor, 0) + 1
        )

    if not floor_usage:

        return {
            "trigger": "Friday afternoons",
            "underused_floors": [],
            "utilization_threshold_pct": 40,
            "recommended_consolidation": [],
            "primary_savings": 0,
            "secondary": {},
            "total_savings": 0,
        }

    sorted_floors = sorted(
        floor_usage.items(),
        key=lambda x: x[1]
    )

    underused = [
        floor
        for floor, _
        in sorted_floors[:3]
    ]

    primary_savings = len(underused) * 700

    janitorial_savings = (
        len(underused) * 160
    )

    cleaning_savings = (
        len(underused) * 40
    )

    security_savings = (
        len(underused) * 70
    )

    secondary = {
        "janitorial_hours_per_week":
            len(underused) * 4,

        "janitorial_savings":
            janitorial_savings,

        "cleaning_supplies_pct":
            25,

        "cleaning_supplies_savings":
            cleaning_savings,

        "security_rounds_reduced":
            len(underused),

        "security_savings":
            security_savings,
    }

    total_secondary = (
        janitorial_savings
        + cleaning_savings
        + security_savings
    )

    return {
        "trigger":
            "Low occupancy periods",

        "underused_floors":
            underused,

        "utilization_threshold_pct":
            round(
                LOW_OCCUPANCY_THRESHOLD * 100
            ),

        "recommended_consolidation":
            underused[:2],

        "primary_savings":
            round(primary_savings, 2),

        "secondary":
            secondary,

        "total_savings":
            round(
                primary_savings
                + total_secondary,
                2,
            ),
    }


def get_domino_effect(
    primary_energy_savings
):

    manpower = round(
        primary_energy_savings * 0.18,
        2,
    )

    materials = round(
        primary_energy_savings * 0.06,
        2,
    )

    security = round(
        primary_energy_savings * 0.09,
        2,
    )

    maintenance = round(
        primary_energy_savings * 0.05,
        2,
    )

    total = round(
        primary_energy_savings
        + manpower
        + materials
        + security
        + maintenance,
        2,
    )

    return {
        "primary_energy_savings":
            primary_energy_savings,

        "secondary_manpower_savings":
            manpower,

        "secondary_materials_savings":
            materials,

        "secondary_security_savings":
            security,

        "secondary_maintenance_savings":
            maintenance,

        "total_savings":
            total,
    }


def get_logistics_optimization():

    since = datetime.utcnow() - timedelta(days=30)

    resources = (
        Resource.query.filter(
            Resource.timestamp >= since
        ).all()
    )

    total_cost = sum(
        float(r.cost or 0)
        for r in resources
    )

    estimated_logistics_savings = round(
        total_cost * 0.03,
        2,
    )

    return {
        "transportation":
            "Consolidate deliveries into scheduled batches to reduce unnecessary trips.",

        "materials":
            "Use bulk purchasing and centralized inventory management.",

        "manpower":
            "Align workforce scheduling with occupancy demand patterns.",

        "estimated_monthly_savings":
            estimated_logistics_savings,

        "delivery_reduction_pct":
            35,

        "inventory_cost_reduction_pct":
            18,
    }