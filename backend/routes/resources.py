from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request

from models import Resource, db

resources_bp = Blueprint("resources", __name__)


def _parse_date(value):
    if not value:
        return None
    return datetime.fromisoformat(value)


@resources_bp.route("", methods=["GET"])
def list_resources():
    query = Resource.query

    floor = request.args.get("floor")
    resource_type = request.args.get("resource_type")
    start_date = _parse_date(request.args.get("start_date"))
    end_date = _parse_date(request.args.get("end_date"))

    if floor:
        query = query.filter(Resource.floor == floor)
    if resource_type:
        query = query.filter(Resource.resource_type == resource_type)
    if start_date:
        query = query.filter(Resource.timestamp >= start_date)
    if end_date:
        query = query.filter(Resource.timestamp <= end_date)

    rows = query.order_by(Resource.timestamp.desc()).limit(2000).all()
    return jsonify([r.to_dict() for r in rows])


@resources_bp.route("/summary", methods=["GET"])
def resources_summary():
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    yesterday_start = today_start - timedelta(days=1)

    summary = {}
    for resource_type in ("electricity", "water"):
        today_total = (
            db.session.query(db.func.coalesce(db.func.sum(Resource.value), 0))
            .filter(Resource.resource_type == resource_type, Resource.timestamp >= today_start)
            .scalar()
        )
        yesterday_total = (
            db.session.query(db.func.coalesce(db.func.sum(Resource.value), 0))
            .filter(
                Resource.resource_type == resource_type,
                Resource.timestamp >= yesterday_start,
                Resource.timestamp < today_start,
            )
            .scalar()
        )
        today_total = float(today_total or 0)
        yesterday_total = float(yesterday_total or 0)
        trend = round(((today_total - yesterday_total) / yesterday_total) * 100, 1) if yesterday_total else 0.0

        cost_total = (
            db.session.query(db.func.coalesce(db.func.sum(Resource.cost), 0))
            .filter(Resource.resource_type == resource_type, Resource.timestamp >= today_start)
            .scalar()
        )

        summary[resource_type] = {
            "value": round(today_total, 2),
            "trend_pct": trend,
            "cost": round(float(cost_total or 0), 2),
        }

    return jsonify(summary)


@resources_bp.route("/trend", methods=["GET"])
def resources_trend():
    days = int(request.args.get("days", 7))
    resource_type = request.args.get("resource_type", "electricity")
    since = datetime.utcnow() - timedelta(days=days)

    rows = (
        Resource.query.filter(Resource.resource_type == resource_type, Resource.timestamp >= since)
        .order_by(Resource.timestamp.asc())
        .all()
    )

    by_day = {}
    for r in rows:
        day = r.timestamp.date().isoformat()
        by_day.setdefault(day, 0.0)
        by_day[day] += float(r.value)

    data = [{"date": day, "value": round(value, 2)} for day, value in sorted(by_day.items())]
    return jsonify(data)


@resources_bp.route("/by-floor", methods=["GET"])
def resources_by_floor():
    resource_type = request.args.get("resource_type", "electricity")
    since = datetime.utcnow() - timedelta(days=1)

    rows = (
        db.session.query(Resource.floor, db.func.sum(Resource.value))
        .filter(Resource.resource_type == resource_type, Resource.timestamp >= since)
        .group_by(Resource.floor)
        .all()
    )

    data = [{"floor": floor, "value": round(float(value or 0), 2)} for floor, value in rows]
    data.sort(key=lambda d: d["floor"])
    return jsonify(data)
