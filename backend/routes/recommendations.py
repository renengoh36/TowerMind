from datetime import datetime

from flask import Blueprint, jsonify, request

from models import Recommendation, db
from services.recommendation_engine import generate_recommendations

recommendations_bp = Blueprint("recommendations", __name__)


@recommendations_bp.route("", methods=["GET"])
def list_recommendations():
    query = Recommendation.query

    category = request.args.get("category")
    implemented = request.args.get("implemented")

    if category and category != "all":
        query = query.filter(Recommendation.category == category)
    if implemented is not None:
        query = query.filter(Recommendation.implemented == (implemented.lower() == "true"))

    rows = query.order_by(Recommendation.estimated_savings.desc()).all()
    return jsonify([r.to_dict() for r in rows])


@recommendations_bp.route("/summary", methods=["GET"])
def recommendations_summary():
    total = (
        db.session.query(db.func.coalesce(db.func.sum(Recommendation.estimated_savings), 0))
        .filter(Recommendation.implemented.is_(False))
        .scalar()
    )
    return jsonify({"total_potential_savings": round(float(total or 0), 2)})


@recommendations_bp.route("/<int:rec_id>/implement", methods=["PUT"])
def implement_recommendation(rec_id):
    rec = Recommendation.query.get_or_404(rec_id)
    rec.implemented = True
    rec.implemented_at = datetime.utcnow()
    db.session.commit()
    return jsonify(rec.to_dict())


@recommendations_bp.route("/generate", methods=["GET"])
def generate():
    created = generate_recommendations()
    return jsonify([r.to_dict() for r in created])
