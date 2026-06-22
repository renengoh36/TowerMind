from datetime import datetime, timedelta

from models import Anomaly, Recommendation, Resource, db
from services.forecasting import get_next_month_forecast

ENERGY_CO2_FACTOR = 0.16
WATER_CO2_FACTOR = 0.05


def _carbon_equivalent(kg):

    if kg >= 2000:
        return "Solar panels on 1 office roof"

    if kg >= 1000:
        return "1 passenger car removed for a year"

    if kg >= 500:
        return f"{round(kg / 20)} mature trees planted"

    if kg >= 100:
        return "1 smartphone charged for 10 years"

    return "Minimal carbon impact"


def generate_recommendations():

    since = datetime.utcnow() - timedelta(days=7)

    Recommendation.query.filter(
        Recommendation.implemented.is_(False)
    ).delete()

    db.session.commit()

    recommendations = []

    anomalies = Anomaly.query.filter(
        Anomaly.status != "resolved"
    ).all()

    forecast = get_next_month_forecast()

    energy_anomalies = [
        a for a in anomalies
        if a.anomaly_type in (
            "energy_spike",
            "overnight_usage",
            "equipment_failure",
        )
    ]

    water_anomalies = [
        a for a in anomalies
        if a.anomaly_type == "water_leak"
    ]

    overnight_count = len([
        a for a in anomalies
        if a.anomaly_type == "overnight_usage"
    ])

    equipment_count = len([
        a for a in anomalies
        if a.anomaly_type == "equipment_failure"
    ])

    energy_spike_count = len([
        a for a in anomalies
        if a.anomaly_type == "energy_spike"
    ])

    critical_energy = len([
        a for a in energy_anomalies
        if a.severity == "critical"
    ])

    high_energy = len([
        a for a in energy_anomalies
        if a.severity == "high"
    ])

    medium_energy = len([
        a for a in energy_anomalies
        if a.severity == "medium"
    ])

    # ==================================================
    # ENERGY RECOMMENDATION
    # ==================================================

    if energy_anomalies:

        savings = min(
            (
            critical_energy * 800
            + high_energy * 500
            + medium_energy * 200
        ),
        8000
        )
        
        carbon = round(
            savings * ENERGY_CO2_FACTOR,
            2,
        )

        if overnight_count >= max(
            energy_spike_count,
            equipment_count,
        ):

            title = "Automate after-hours shutdown"

            description = (
                "Multiple overnight usage anomalies were detected. "
                "Implement automatic shutdown schedules for lighting, "
                "HVAC systems and non-essential equipment."
            )

        elif equipment_count >= energy_spike_count:

            title = "Preventive equipment maintenance"

            description = (
                "Equipment-related anomalies indicate potential "
                "performance degradation. Schedule preventive "
                "maintenance inspections."
            )

        else:

            title = "HVAC optimisation programme"

            description = (
                "Recurring electricity spikes indicate cooling "
                "inefficiencies. Optimise HVAC scheduling and "
                "temperature setpoints."
            )

        recommendations.append(
            Recommendation(
                title=title,
                description=description,
                category="electricity",
                estimated_savings=round(
                    savings,
                    2,
                ),
                confidence_score=92,
                carbon_impact=carbon,
                carbon_equivalent=_carbon_equivalent(
                    carbon
                ),
            )
        )

    # ==================================================
    # WATER RECOMMENDATION
    # ==================================================

    if water_anomalies:

        critical_water = len([
            a for a in water_anomalies
            if a.severity == "critical"
        ])

        high_water = len([
            a for a in water_anomalies
            if a.severity == "high"
        ])

        savings = (
            critical_water * 1000
            + high_water * 600
        )

        carbon = round(
            savings * WATER_CO2_FACTOR,
            2,
        )

        recommendations.append(
            Recommendation(
                title="Repair detected water leaks",
                description=(
                    "Multiple abnormal water consumption events "
                    "suggest potential leaks or faulty plumbing "
                    "components requiring inspection."
                ),
                category="water",
                estimated_savings=round(
                    savings,
                    2,
                ),
                confidence_score=90,
                carbon_impact=carbon,
                carbon_equivalent=_carbon_equivalent(
                    carbon
                ),
            )
        )

    # ==================================================
    # SPACE OPTIMISATION
    # ==================================================

    recommendations.append(
        Recommendation(
            title="Consolidate low-occupancy floors",
            description=(
                "Occupancy analytics indicate opportunities to "
                "consolidate underutilised floors during low-demand "
                "periods."
            ),
            category="space",
            estimated_savings=2100,
            occupancy_based=True,
            confidence_score=84,
            carbon_impact=320,
            carbon_equivalent=_carbon_equivalent(
                320
            ),
        )
    )

    # ==================================================
    # MANPOWER OPTIMISATION
    # ==================================================

    recommendations.append(
        Recommendation(
            title="Optimise janitorial scheduling",
            description=(
                "Align cleaning schedules with occupancy patterns "
                "to reduce unnecessary labour costs."
            ),
            category="manpower",
            estimated_savings=480,
            confidence_score=80,
            carbon_impact=0,
            carbon_equivalent="N/A",
            occupancy_based=True,
        )
    )

    # ==================================================
    # FORECAST-BASED RECOMMENDATION
    # ==================================================

    if forecast.get("budget_risk"):

        recommendations.append(
            Recommendation(
                title="Prevent forecasted budget overrun",
                description=(
                    "Forecasting models predict increased utility "
                    "costs next month. Implement demand-management "
                    "strategies immediately."
                ),
                category="forecast",
                estimated_savings=3000,
                confidence_score=88,
                carbon_impact=480,
                carbon_equivalent=_carbon_equivalent(
                    480
                ),
            )
        )

    for recommendation in recommendations:

        db.session.add(
            recommendation
        )

    db.session.commit()

    return recommendations