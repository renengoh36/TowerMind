from datetime import datetime

from flask import Blueprint, jsonify, request

from models import Anomaly, db
from services.anomaly_detector import detect_anomalies

anomalies_bp = Blueprint("anomalies", __name__)


@anomalies_bp.route("", methods=["GET"])
def list_anomalies():
    query = Anomaly.query

    severity = request.args.get("severity")
    status = request.args.get("status")
    limit = int(request.args.get("limit", 100))

    if severity and severity != "all":
        query = query.filter(Anomaly.severity == severity)
    if status and status != "all":
        query = query.filter(Anomaly.status == status)

    rows = query.order_by(Anomaly.created_at.desc()).limit(limit).all()
    return jsonify([a.to_dict() for a in rows])


@anomalies_bp.route("/summary", methods=["GET"])
def anomalies_summary():
    critical = Anomaly.query.filter(Anomaly.severity == "critical", Anomaly.status != "resolved").count()
    medium = Anomaly.query.filter(Anomaly.severity == "medium", Anomaly.status != "resolved").count()
    resolved = Anomaly.query.filter(Anomaly.status == "resolved").count()
    return jsonify({"critical": critical, "medium": medium, "resolved": resolved})


@anomalies_bp.route("/<int:anomaly_id>/status", methods=["PUT"])
def update_anomaly_status(anomaly_id):
    anomaly = Anomaly.query.get_or_404(anomaly_id)
    data = request.get_json(force=True) or {}
    status = data.get("status")
    if status not in ("acknowledged", "resolved", "pending"):
        return jsonify({"error": "Invalid status"}), 400

    anomaly.status = status
    if status == "resolved":
        anomaly.resolved_at = datetime.utcnow()
    db.session.commit()
    return jsonify(anomaly.to_dict())


@anomalies_bp.route("/detect", methods=["GET"])
def run_detection():
    created = detect_anomalies()
    return jsonify([a.to_dict() for a in created])
