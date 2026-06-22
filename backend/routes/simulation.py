from flask import Blueprint, jsonify, request

from services.simulation_engine import (
    building_context,
    fallback_scenarios,
    run_simulation,
)

simulation_bp = Blueprint(
    "simulation",
    __name__
)


# -----------------------------------------
# Health Check
# -----------------------------------------
@simulation_bp.route("", methods=["GET"])
def home():
    return jsonify({
        "service": "TowerMind Simulation Engine",
        "status": "running"
    })


# -----------------------------------------
# Building Context
# -----------------------------------------
@simulation_bp.route("/test", methods=["GET"])
def test():

    return jsonify(
        building_context()
    )


# -----------------------------------------
# Main Simulation
# Supports:
# GET  /generate?query=...
# POST /generate
# -----------------------------------------
@simulation_bp.route(
    "/generate",
    methods=["GET", "POST"]
)
def generate():

    if request.method == "GET":

        query = request.args.get(
            "query",
            "Reduce HVAC usage by 10%"
        )

    else:

        data = (
            request.get_json(
                silent=True
            )
            or {}
        )

        query = (
            data.get("query")
            or ""
        ).strip()

    if not query:

        return jsonify({
            "error": "query is required"
        }), 400

    result = run_simulation(
        query
    )

    return jsonify(
        result
    )


# -----------------------------------------
# Force Digital Twin
# (No Gemini)
# -----------------------------------------
@simulation_bp.route(
    "/fallback",
    methods=["GET", "POST"]
)
def fallback():

    if request.method == "GET":

        query = request.args.get(
            "query",
            "Reduce HVAC usage by 10%"
        )

    else:

        data = (
            request.get_json(
                silent=True
            )
            or {}
        )

        query = (
            data.get("query")
            or ""
        ).strip()

    if not query:

        return jsonify({
            "error": "query is required"
        }), 400

    context = building_context()

    result = fallback_scenarios(
        query,
        context
    )

    return jsonify(
        result
    )