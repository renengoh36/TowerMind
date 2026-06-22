import json
import re
import statistics
from datetime import datetime, timedelta

from models import Resource, SimulationLog, db
from services import gemini_service

FLOORS = 8
PEAK_HOURS = "9 AM - 6 PM"


def building_context():
    since = datetime.utcnow() - timedelta(days=30)

    rows = Resource.query.filter(
        Resource.timestamp >= since
    ).all()

    total_cost = sum(
        float(r.cost or 0)
        for r in rows
    )

    elec_rows = [
        r for r in rows
        if r.resource_type == "electricity"
    ]

    current_usage = (
        sum(
            float(r.value)
            for r in elec_rows[-(24 * 7):]
        )
        if elec_rows
        else 0
    )

    recent_rows = (
        Resource.query.filter(
            Resource.resource_type == "electricity"
        )
        .order_by(Resource.timestamp.desc())
        .limit(24 * 7)
        .all()
    )

    if recent_rows:

        occupancy = round(
            statistics.mean(
                [
                    float(r.occupancy_rate or 0)
                    for r in recent_rows
                ]
            ),
            1,
        )

        occupancy_count = round(
            statistics.mean(
                [
                    float(r.occupancy_count or 0)
                    for r in recent_rows
                ]
            )
        )

    else:

        occupancy = 50.0
        occupancy_count = 25

    recent_carbon = elec_rows[-(24 * 7):]

    carbon_footprint = round(
        sum(
            float(r.carbon_emission or 0)
            for r in recent_carbon
        ),
        2,
    )

    avg_daily_cost = (
        total_cost / 30
        if total_cost > 0
        else 0
    )

    avg_daily_usage = (
        sum(float(r.value) for r in elec_rows) / 30
        if elec_rows
        else 0
    )

    return {
        "total_cost": round(total_cost, 2),
        "avg_daily_cost": round(avg_daily_cost, 2),
        "current_usage": round(current_usage, 2),
        "avg_daily_usage": round(avg_daily_usage, 2),
        "occupancy": occupancy,
        "occupancy_count": occupancy_count,
        "carbon_footprint": carbon_footprint,
        "floors": FLOORS,
        "peak_hours": PEAK_HOURS,
    }


def _make_scenario(name, desc, savings, carbon_pct, effort, comfort, timeline, risk):
    return {
        "name": name,
        "description": desc,
        "savings": savings,
        "carbon_reduction": carbon_pct,
        "effort": effort,
        "comfort_score": comfort,
        "timeline": timeline,
        "risk": risk,
    }


def fallback_scenarios(user_query, context):
    occupancy      = float(context.get("occupancy", 50))
    avg_daily_cost = float(context.get("avg_daily_cost", 0))
    carbon         = float(context.get("carbon_footprint", 0))
    monthly_cost   = avg_daily_cost * 30

    opt = min(0.30, max(0.05,
        ((100 - occupancy) / 100) * 0.6 + min(carbon / 10000, 1) * 0.4
    ))

    q = user_query.lower()

    # Extract explicit % target if present
    pct_match  = re.search(r'(\d+)\s*%', q)
    target_pct = int(pct_match.group(1)) if pct_match else None

    # ── Intent classification ─────────────────────────────────────────────────
    is_cost     = any(w in q for w in ["cost", "how much", "estimate", "budget",
                                        "spend", "bill", "forecast", "next month",
                                        "projection", "predict", "price", "expense"])
    is_carbon   = any(w in q for w in ["carbon", "co2", "emission", "green",
                                        "sustainab", "eco", "net zero", "footprint"])
    is_hvac     = any(w in q for w in ["hvac", "cooling", "chiller", "temperature",
                                        "air con", "ventilat", "thermostat"])  \
                  or re.search(r'\bac\b', q) is not None
    is_lighting = any(w in q for w in ["light", "lighting", "led", "lamp",
                                        "bulb", "illumin", "lux"])
    is_water    = any(w in q for w in ["water", "leak", "plumb", "tap", "pipe"])
    is_space    = any(w in q for w in ["floor", "occupancy", "space", "room",
                                        "desk", "consolidat", "utiliz", "seat"])
    is_maintain = any(w in q for w in ["maintain", "fix", "repair", "upgrade",
                                        "service", "fault", "broken", "replace"])
    is_energy   = any(w in q for w in ["energy", "electricity", "power", "kwh",
                                        "consumption", "usage"])
    is_reduce   = any(w in q for w in ["reduce", "cut", "lower", "decrease",
                                        "minimis", "minimiz", "save", "saving",
                                        "improv", "optimis", "optimiz", "efficien"])

    # Resolve to one primary intent.
    # Specific systems (HVAC, carbon, lighting…) win over generic cost/energy queries.
    # cost_reduction: "reduce the bill" — action-oriented, no specific system named
    # cost_forecast:  "what will the bill be" — information-oriented
    if is_carbon:
        intent = "carbon"
    elif is_hvac:
        intent = "hvac"
    elif is_lighting:
        intent = "lighting"
    elif is_water:
        intent = "water"
    elif is_space:
        intent = "space"
    elif is_maintain:
        intent = "maintenance"
    elif is_cost and is_reduce and not target_pct:
        intent = "cost_reduction"
    elif is_cost and not is_reduce:
        intent = "cost_forecast"
    elif is_energy or is_reduce or target_pct:
        intent = "energy_reduction"
    else:
        intent = "general"

    # ── Scenario templates per intent ─────────────────────────────────────────
    mc = monthly_cost  # shorthand

    if intent == "cost_forecast":
        projected = round(mc * 1.03)  # +3% if no action
        mod_save  = round(mc * opt * 0.50)
        full_save = round(mc * opt * 0.95)
        sa = _make_scenario(
            "Status Quo Trajectory",
            f"No operational changes. Based on current trends, next month's bill is projected at "
            f"RM {projected:,} — a ~3% seasonal increase from RM {mc:,.0f}/month.",
            0, 0, "Low", 90, "Immediate", "Cost continues to rise without intervention"
        )
        sb = _make_scenario(
            "Moderate Optimisation",
            f"Apply HVAC scheduling and after-hours lighting controls. Projected next-month cost: "
            f"RM {max(0, mc - mod_save):,.0f} — saving RM {mod_save:,}/month.",
            mod_save, round(mod_save / mc * 100, 1) if mc else 0,
            "Low", 84, "3–5 days", "Minor scheduling adjustments needed"
        )
        sc = _make_scenario(
            "Full Optimisation Package",
            f"Implement all recommended measures (HVAC zoning, LED controls, floor consolidation). "
            f"Projected next-month cost: RM {max(0, mc - full_save):,.0f} — saving RM {full_save:,}/month.",
            full_save, round(full_save / mc * 100, 1) if mc else 0,
            "Medium", 78, "2–3 weeks", "Requires coordination across facilities team"
        )
        analysis = (
            f"Current monthly operational cost is RM {mc:,.0f}. Without changes, next month is projected "
            f"at RM {projected:,} due to seasonal load. Applying moderate optimisation could reduce the bill "
            f"to RM {max(0, mc - mod_save):,.0f}, while full optimisation targets RM {max(0, mc - full_save):,.0f}."
        )

    elif intent == "cost_reduction":
        # Action-oriented: what to do THIS month to lower the bill
        quick_save = round(mc * opt * 0.30)
        sched_save = round(mc * opt * 0.55)
        full_save  = round(mc * opt * 0.90)
        sa = _make_scenario(
            "Immediate Quick Wins",
            f"Actions doable this week: raise HVAC setpoint by 2°C, switch off lights on unoccupied floors, "
            f"and disable non-essential equipment after {PEAK_HOURS}. "
            f"Expected saving on next bill: RM {quick_save:,}.",
            quick_save, round(quick_save / mc * 100, 1) if mc else 0,
            "Low", 80, "This week", "Minimal disruption — settings-only changes"
        )
        sb = _make_scenario(
            "Operational Scheduling Overhaul",
            f"Reschedule HVAC pre-cooling to start 30 min later, activate floor-by-floor shutdown after 7 PM, "
            f"and eliminate weekend baseline loads. Current occupancy: {occupancy:.0f}% — "
            f"significant after-hours waste identified.",
            sched_save, round(sched_save / mc * 100, 1) if mc else 0,
            "Medium", 82, "3–5 days", "Requires facilities team to update schedules"
        )
        sc = _make_scenario(
            "Full Month Reduction Plan",
            f"Combine quick wins + operational scheduling + floor consolidation for maximum impact. "
            f"Activate demand response during peak grid hours to reduce tariff charges. "
            f"Projected saving: RM {full_save:,} off next month's bill.",
            full_save, round(full_save / mc * 100, 1) if mc else 0,
            "Medium", 77, "1–2 weeks", "Cross-team coordination needed; impact visible next billing cycle"
        )
        analysis = (
            f"To reduce next month's electricity bill from RM {mc:,.0f}, TowerMind identified three "
            f"actionable pathways. Quick Wins target RM {quick_save:,} savings with zero capital spend. "
            f"The Full Month Plan combines all levers to save RM {full_save:,} — visible on your next bill."
        )

    elif intent == "carbon":
        sa = _make_scenario(
            "Energy Efficiency Drive",
            f"Reduce electricity consumption through HVAC setpoint adjustment and lighting controls. "
            f"Current carbon footprint: {carbon:,.0f} kg CO₂e/week.",
            round(mc * opt * 0.35), 15.0, "Low", 80, "1 week",
            "Minor comfort adjustments for occupants"
        )
        sb = _make_scenario(
            "Smart Automation & Scheduling",
            f"Deploy occupancy sensors to auto-shut HVAC and lighting in unused zones. "
            f"Reduces idle energy waste driving {round(carbon * 0.25):,.0f} kg CO₂e of excess emissions.",
            round(mc * opt * 0.55), 25.0, "Medium", 85, "2–3 weeks",
            "Requires sensor installation on all floors"
        )
        sc = _make_scenario(
            "Green Building Programme",
            f"Full automation + LED retrofit + renewable energy credits. Targets net-zero for "
            f"non-critical loads. Estimated carbon reduction: 40%+ vs current {carbon:,.0f} kg CO₂e.",
            round(mc * opt * 0.85), 40.0, "High", 76, "2–3 months",
            "Capital investment required; phased rollout recommended"
        )
        analysis = (
            f"Current carbon footprint is {carbon:,.0f} kg CO₂e/week. TowerMind identified {round(opt * 100, 1)}% "
            f"optimisation potential. The Green Building Programme offers the highest carbon impact but requires "
            f"upfront investment; Smart Automation delivers 25% reduction with moderate effort."
        )

    elif intent == "hvac":
        sa = _make_scenario(
            "Setpoint Adjustment",
            f"Raise HVAC setpoint by 2°C during business hours (9 AM–6 PM). "
            f"Current building occupancy: {occupancy:.0f}% — comfort impact is minimal at this level.",
            round(mc * 0.08), 8.0, "Low", 76, "1 day",
            "Some occupants may notice temperature change"
        )
        sb = _make_scenario(
            "Zoned Cooling Strategy",
            f"Divide building into {FLOORS} cooling zones. Deactivate zones with <20% occupancy after 7 PM. "
            f"High-occupancy floors maintain full cooling.",
            round(mc * 0.14), 14.0, "Medium", 83, "1 week",
            "BMS configuration update required"
        )
        sc = _make_scenario(
            "Predictive Smart Climate",
            f"Combine setpoint adjustment, zone control, and AI-driven pre-cooling before {PEAK_HOURS}. "
            f"System learns occupancy patterns over 2 weeks for autonomous scheduling.",
            round(mc * 0.20), 20.0, "Medium", 80, "3–4 weeks",
            "Requires BMS integration and 2-week learning period"
        )
        analysis = (
            f"HVAC is typically 40–60% of a building's energy spend. At {occupancy:.0f}% occupancy, "
            f"significant HVAC waste exists in under-used zones. Predictive Smart Climate delivers the highest "
            f"savings but requires BMS integration; Setpoint Adjustment is the fastest win."
        )

    elif intent == "lighting":
        sa = _make_scenario(
            "Motion-Sensor Deployment",
            f"Install occupancy-triggered sensors on all {FLOORS} floors. Lights auto-off after "
            f"10 minutes of no motion. Est. 30–35% reduction in lighting load.",
            round(mc * 0.06), 6.0, "Low", 88, "3–5 days",
            "Minor installation work per floor"
        )
        sb = _make_scenario(
            "LED Retrofit",
            f"Replace fluorescent tubes with smart LED panels across all common areas and offices. "
            f"LEDs use 60% less power and last 5× longer than current fixtures.",
            round(mc * 0.10), 10.0, "Medium", 90, "2–3 weeks",
            "Capital cost for LED units; ROI typically < 18 months"
        )
        sc = _make_scenario(
            "Full Lighting Intelligence",
            f"Motion sensors + LED retrofit + daylight harvesting (dim lights when natural light is sufficient). "
            f"Automated after-hours shutdown on all non-critical areas.",
            round(mc * 0.16), 16.0, "Medium", 89, "4–6 weeks",
            "Requires electrical contractor for full retrofit"
        )
        analysis = (
            f"Lighting typically accounts for 20–30% of a building's electricity bill. "
            f"At {occupancy:.0f}% occupancy, many zones are lit unnecessarily. "
            f"Full Lighting Intelligence combines all three levers for maximum impact."
        )

    elif intent == "water":
        sa = _make_scenario(
            "Leak Detection Programme",
            f"Install smart water meters on each floor to detect pipe leaks and abnormal consumption. "
            f"Early detection prevents major water waste and structural damage.",
            round(mc * 0.04), 3.0, "Low", 95, "3–5 days",
            "Meter installation may cause brief supply interruptions per floor"
        )
        sb = _make_scenario(
            "Flow Restrictors & Sensor Taps",
            f"Fit all taps and showers with flow restrictors and auto-shutoff sensors. "
            f"Reduces average water consumption by 25–30% with no occupant behaviour change required.",
            round(mc * 0.07), 5.0, "Low", 88, "1–2 weeks",
            "Minor plumbing work; no disruption to operations"
        )
        sc = _make_scenario(
            "Full Water Management System",
            f"Smart meters + flow restrictors + rainwater harvesting for non-potable uses (toilets, cooling towers). "
            f"Comprehensive programme targeting 40% water cost reduction.",
            round(mc * 0.12), 8.0, "High", 85, "2–3 months",
            "Requires civil works for rainwater collection system"
        )
        analysis = (
            f"Water costs are often under-monitored in commercial buildings. "
            f"Leak detection alone can identify 10–15% waste in aging pipe systems. "
            f"The Full Water Management System delivers the greatest long-term savings and sustainability impact."
        )

    elif intent == "space":
        sa = _make_scenario(
            "Floor Consolidation",
            f"Consolidate all staff to {max(1, round(FLOORS * occupancy / 100))} active floors based on "
            f"current {occupancy:.0f}% average occupancy. Shut down HVAC and lighting on vacant floors after 6 PM.",
            round(mc * opt * 0.45), round(opt * 45, 1), "Low", 78, "2–3 days",
            "Staff may need to relocate to different floors"
        )
        sb = _make_scenario(
            "Hot-Desk + Booking System",
            f"Introduce hot-desking with a room-booking app. Prevents ghost bookings and ensures HVAC/lighting "
            f"only activates for confirmed reservations. Occupancy currently: {occupancy:.0f}%.",
            round(mc * opt * 0.60), round(opt * 60, 1), "Medium", 82, "2–3 weeks",
            "Requires booking system deployment and change management"
        )
        sc = _make_scenario(
            "Dynamic Workspace Strategy",
            f"Floor consolidation + hot-desk programme + demand-based HVAC zoning. "
            f"AI assigns desk clusters based on daily booking patterns to minimise heated/cooled zones.",
            round(mc * opt * 0.90), round(opt * 90, 1), "Medium", 80, "4–6 weeks",
            "Culture change required; needs facilities + HR alignment"
        )
        analysis = (
            f"At {occupancy:.0f}% average occupancy, roughly {round(100 - occupancy)}% of floor space is "
            f"consuming energy with no occupants. Dynamic Workspace Strategy addresses this systematically "
            f"and can deliver the highest savings relative to effort."
        )

    elif intent == "maintenance":
        sa = _make_scenario(
            "Preventive Maintenance Schedule",
            f"Establish quarterly inspection cycles for HVAC filters, pumps, and electrical panels. "
            f"Dirty filters alone increase energy consumption by 10–15%.",
            round(mc * 0.08), 6.0, "Low", 85, "1 week",
            "Requires scheduling downtime for equipment access"
        )
        sb = _make_scenario(
            "Predictive Maintenance (IoT Sensors)",
            f"Deploy vibration and temperature sensors on critical equipment (chillers, pumps, AHUs). "
            f"Predict failures before they occur — reduces emergency repair costs and energy waste from degraded equipment.",
            round(mc * 0.12), 10.0, "Medium", 87, "3–4 weeks",
            "IoT sensor procurement and installation required"
        )
        sc = _make_scenario(
            "Full Equipment Upgrade",
            f"Replace end-of-life HVAC units and lighting fixtures with energy-efficient models. "
            f"Modern chillers are 20–35% more efficient than units over 10 years old.",
            round(mc * 0.22), 18.0, "High", 90, "3–6 months",
            "High capital outlay; ROI typically 3–5 years"
        )
        analysis = (
            f"Poorly maintained equipment is one of the largest hidden energy costs. "
            f"Preventive maintenance is the fastest and cheapest first step. "
            f"Full Equipment Upgrade delivers the highest long-term savings but requires capital planning."
        )

    else:
        # Energy reduction (with optional % target) or general
        tgt = target_pct or 15
        if tgt <= 10:
            effort_a, effort_b, effort_c = "Low", "Low", "Medium"
            m_a, m_b, m_c = 0.25, 0.40, 0.60
        elif tgt <= 20:
            effort_a, effort_b, effort_c = "Low", "Medium", "Medium"
            m_a, m_b, m_c = 0.40, 0.60, 0.90
        elif tgt <= 30:
            effort_a, effort_b, effort_c = "Medium", "Medium", "High"
            m_a, m_b, m_c = 0.55, 0.75, 1.10
        else:
            effort_a, effort_b, effort_c = "High", "High", "High"
            m_a, m_b, m_c = 0.70, 0.90, 1.30

        sv_a = round(mc * opt * m_a)
        sv_b = round(mc * opt * m_b)
        sv_c = round(mc * opt * m_c)

        if tgt <= 10:
            sa = _make_scenario("Quick HVAC Tweak",
                f"Raise HVAC setpoint by 1°C and cut after-hours runtime. Targets {tgt}% savings with minimal disruption.",
                sv_a, round(sv_a / mc * 100, 1) if mc else 0, effort_a, 80, "1–2 days", "Near-zero occupant impact")
            sb = _make_scenario("Lighting Quick-Win",
                f"Auto-off lights on unoccupied floors and dim corridor lighting after 8 PM.",
                sv_b, round(sv_b / mc * 100, 1) if mc else 0, effort_b, 87, "2–3 days", "Minimal disruption")
            sc = _make_scenario("Combined Quick Wins",
                f"Bundle HVAC tweak + lighting controls for a combined {tgt}% energy reduction with near-zero disruption.",
                sv_c, round(sv_c / mc * 100, 1) if mc else 0, effort_c, 83, "3–5 days", "Low risk overall")
        elif tgt <= 20:
            sa = _make_scenario("Climate Shift",
                f"Raise HVAC setpoint by 2°C and optimise cooling schedules. Occupancy: {occupancy:.0f}%. Targets {tgt}% reduction.",
                sv_a, round(sv_a / mc * 100, 1) if mc else 0, effort_a, 75, "2 days", "Minor comfort concerns")
            sb = _make_scenario("Space Rationalisation",
                f"Consolidate underutilised floors and reduce after-hours HVAC to hit the {tgt}% target.",
                sv_b, round(sv_b / mc * 100, 1) if mc else 0, effort_b, 82, "1 week", "Requires operational coordination")
            sc = _make_scenario("Hybrid Optimisation",
                f"HVAC optimisation + occupancy consolidation + smart scheduling — calibrated for {tgt}% energy reduction.",
                sv_c, round(sv_c / mc * 100, 1) if mc else 0, effort_c, 78, "3–5 days", "Moderate implementation effort")
        elif tgt <= 30:
            sa = _make_scenario("Deep HVAC Programme",
                f"Zoned cooling, predictive scheduling, setpoint optimisation — pathway to {tgt}% savings.",
                sv_a, round(sv_a / mc * 100, 1) if mc else 0, effort_a, 76, "3–5 days", "BMS reconfiguration needed")
            sb = _make_scenario("Operational Consolidation",
                f"Merge low-occupancy floors, cut after-hours HVAC and lighting. Current occupancy: {occupancy:.0f}%.",
                sv_b, round(sv_b / mc * 100, 1) if mc else 0, effort_b, 80, "2–3 weeks", "Staff relocation coordination required")
            sc = _make_scenario("Smart Building Overhaul",
                f"HVAC zoning + floor consolidation + LED retrofit + smart metering — comprehensive {tgt}% reduction plan.",
                sv_c, round(sv_c / mc * 100, 1) if mc else 0, effort_c, 77, "4–6 weeks", "Phased rollout recommended")
        else:
            sa = _make_scenario("Aggressive HVAC & Lighting",
                f"Full HVAC re-zoning + LED retrofit + motion sensors — high-impact push toward {tgt}% savings.",
                sv_a, round(sv_a / mc * 100, 1) if mc else 0, effort_a, 72, "1–2 weeks", "Significant occupant impact likely")
            sb = _make_scenario("Major Space Re-engineering",
                f"Consolidate all operations to 50% of floors, decommission unused HVAC units. Targets {tgt}% reduction.",
                sv_b, round(sv_b / mc * 100, 1) if mc else 0, effort_b, 74, "3–4 weeks", "Major coordination across all teams")
            sc = _make_scenario("Full Building Transformation",
                f"HVAC overhaul + space consolidation + renewable energy integration — aggressive {tgt}%+ savings strategy.",
                sv_c, round(sv_c / mc * 100, 1) if mc else 0, effort_c, 70, "2–3 months", "High capital investment; board approval likely needed")

        analysis = (
            f"TowerMind analysed current occupancy ({occupancy:.0f}%), operational cost "
            f"(RM {mc:,.0f}/month), and carbon footprint ({carbon:,.0f} kg CO₂e). "
            f"Optimisation potential: {round(opt * 100, 1)}%. "
            f"Scenario C (Hybrid/Full) is recommended for maximum impact toward the {tgt}% target."
        )

    # ── Shared scoring + recommendation ───────────────────────────────────────
    for s in [sa, sb, sc]:
        s["score"] = s["savings"] * 0.5 + s["comfort_score"] * 50

    sa["score"] -= 200
    sb["score"] -= 500
    sc["score"] -= 350

    recommendation = max(
        [("scenario_a", sa["score"]), ("scenario_b", sb["score"]), ("scenario_c", sc["score"])],
        key=lambda x: x[1]
    )[0]

    return {
        "scenario_a": sa,
        "scenario_b": sb,
        "scenario_c": sc,
        "recommended": recommendation,
        "analysis": analysis,
        "optimization_potential": round(opt * 100, 1),
        "source": "digital_twin_engine",
    }


def run_simulation(user_query):

    context = building_context()

    result = None
    used_gemini = False

    if gemini_service.is_configured():

        try:

            result = gemini_service.generate_scenarios(
                user_query,
                context
            )

            result["source"] = "gemini"
            used_gemini = True

        except gemini_service.GeminiUnavailableError as e:

            print("=" * 60)
            print("SIMULATION GEMINI ERROR")
            print(str(e))
            print("=" * 60)

            result = None

    if result is None:

        result = fallback_scenarios(
            user_query,
            context
        )

    log = SimulationLog(
        user_query=user_query,
        scenario_a=json.dumps(
            result.get("scenario_a")
        ),
        scenario_b=json.dumps(
            result.get("scenario_b")
        ),
        scenario_c=json.dumps(
            result.get("scenario_c")
        ),
        recommended_scenario=result.get(
            "recommended"
        ),
    )

    db.session.add(log)
    db.session.commit()

    result["used_gemini"] = used_gemini

    return result
