from flask import Blueprint, jsonify, request

from services.scheduler_engine import get_domino_effect, get_logistics_optimization, get_space_consolidation

scheduler_bp = Blueprint("scheduler", __name__)


@scheduler_bp.route("/consolidation", methods=["GET"])
def consolidation():
    return jsonify(get_space_consolidation())


@scheduler_bp.route("/domino-effect", methods=["GET"])
def domino_effect():
    primary = float(request.args.get("primary_savings", 2100))
    return jsonify(get_domino_effect(primary))


@scheduler_bp.route("/logistics", methods=["GET"])
def logistics():
    return jsonify(get_logistics_optimization())
