import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app import create_app
from models import Anomaly, Booking, KpiHistory, Recommendation, Resource, SimulationLog, Occupancy, db
from data.mock_data_generator import (
    generate_bookings,
    generate_kpi_history,
    generate_recommendations,
    generate_resources,
    generate_occupancy,
)


def init_db():
    app = create_app()
    with app.app_context():
        db.drop_all()
        db.create_all()

        # ✅ Step 1: Generate occupancy ONCE
        print("📊 Generating occupancy data (30 days, 8 floors)...")
        occupancy_data = generate_occupancy(days=30)
        db.session.bulk_save_objects(occupancy_data)
        db.session.commit()
        print(f"  ✅ occupancy: {Occupancy.query.count()} records")

        # ✅ Step 2: Generate resources USING the occupancy data
        print("⚡ Generating resource data (30 days, 8 floors)...")
        resource_data = generate_resources(occupancy_data, days=30)
        db.session.bulk_save_objects(resource_data)
        db.session.commit()
        print(f"  ✅ resources: {Resource.query.count()} records")

        print("📅 Generating booking data (7 days, 20 rooms)...")
        db.session.bulk_save_objects(generate_bookings())
        db.session.commit()
        print(f"  ✅ bookings: {Booking.query.count()} records")

        print("💡 Generating recommendations...")
        db.session.bulk_save_objects(generate_recommendations())
        db.session.commit()
        print(f"  ✅ recommendations: {Recommendation.query.count()} records")

        print("📈 Generating KPI history (6 months)...")
        db.session.bulk_save_objects(generate_kpi_history())
        db.session.commit()
        print(f"  ✅ kpi_history: {KpiHistory.query.count()} records")

        print("\n" + "=" * 50)
        print("✅ DATABASE INITIALIZED SUCCESSFULLY!")
        print("=" * 50)
        print(f"  Occupancy:      {Occupancy.query.count():>6} records")
        print(f"  Resources:      {Resource.query.count():>6} records")
        print(f"  Bookings:       {Booking.query.count():>6} records")
        print(f"  Recommendations:{Recommendation.query.count():>6} records")
        print(f"  KPI History:    {KpiHistory.query.count():>6} records")
        print(f"  Anomalies:      {Anomaly.query.count():>6} records")
        print("=" * 50)


if __name__ == "__main__":
    init_db()