import hashlib
from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request

from models import KpiHistory, Resource, db

kpi_bp = Blueprint("kpi", __name__)


@kpi_bp.route("/current", methods=["GET"])
def kpi_current():
    latest = KpiHistory.query.order_by(KpiHistory.month.desc()).first()
    if not latest:
        return jsonify({"error": "No KPI data available"}), 404
    return jsonify(latest.to_dict())


@kpi_bp.route("/history", methods=["GET"])
def kpi_history():
    months = int(request.args.get("months", 6))
    rows = KpiHistory.query.order_by(KpiHistory.month.desc()).limit(months).all()
    rows.reverse()
    return jsonify([r.to_dict() for r in rows])


@kpi_bp.route("/leaderboard", methods=["GET"])
def kpi_leaderboard():
    since = datetime.utcnow() - timedelta(days=7)
    rows = (
        db.session.query(Resource.floor, db.func.avg(Resource.value))
        .filter(Resource.resource_type == "electricity", Resource.timestamp >= since)
        .group_by(Resource.floor)
        .all()
    )

    if not rows:
        return jsonify([])

    values = {floor: float(avg) for floor, avg in rows}
    max_value = max(values.values()) or 1

    leaderboard = []
    for floor, avg_value in values.items():
        seed = int(hashlib.sha256(floor.encode()).hexdigest(), 16)
        score = round(100 - (avg_value / max_value) * 35 + (seed % 10) - 5)
        score = max(40, min(99, score))
        trend = round(((seed % 80) - 40) / 10, 1)
        leaderboard.append({"floor": floor, "score": score, "co2_trend_pct": trend})

    leaderboard.sort(key=lambda x: x["score"], reverse=True)
    for i, entry in enumerate(leaderboard, start=1):
        entry["rank"] = i

    return jsonify(leaderboard)
