from datetime import datetime

from flask import Blueprint, jsonify, request

from models import Booking, db

bookings_bp = Blueprint("bookings", __name__)


@bookings_bp.route("", methods=["GET"])
def list_bookings():
    query = Booking.query

    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")

    if start_date:
        query = query.filter(Booking.start_time >= datetime.fromisoformat(start_date))
    if end_date:
        query = query.filter(Booking.end_time <= datetime.fromisoformat(end_date))

    rows = query.order_by(Booking.start_time.desc()).limit(500).all()
    return jsonify([b.to_dict() for b in rows])


@bookings_bp.route("", methods=["POST"])
def create_booking():
    data = request.get_json(force=True) or {}
    required = ["floor", "room_name", "booked_by", "start_time", "end_time"]
    missing = [f for f in required if not data.get(f)]
    if missing:
        return jsonify({"error": f"Missing required fields: {', '.join(missing)}"}), 400

    booking = Booking(
        floor=data["floor"],
        room_name=data["room_name"],
        booked_by=data["booked_by"],
        start_time=datetime.fromisoformat(data["start_time"]),
        end_time=datetime.fromisoformat(data["end_time"]),
        status="booked",
    )
    db.session.add(booking)
    db.session.commit()
    return jsonify(booking.to_dict()), 201


@bookings_bp.route("/<int:booking_id>/status", methods=["PUT"])
def update_booking_status(booking_id):
    booking = Booking.query.get_or_404(booking_id)
    data = request.get_json(force=True) or {}
    status = data.get("status")
    if status not in ("cancelled", "completed", "booked"):
        return jsonify({"error": "Invalid status"}), 400

    booking.status = status
    db.session.commit()
    return jsonify(booking.to_dict())
