from datetime import datetime

from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class Resource(db.Model):
    __tablename__ = "resources"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    floor = db.Column(db.String(20), nullable=False, index=True)
    room = db.Column(db.String(50))
    resource_type = db.Column(db.String(20), nullable=False, index=True)  # 'electricity', 'water'
    value = db.Column(db.Numeric(10, 2), nullable=False)
    cost = db.Column(db.Numeric(10, 2))
    
    # ✅ Direct snapshot of occupancy (no foreign key needed)
    occupancy_count = db.Column(db.Integer, default=0)  # Number of people at that time
    occupancy_rate = db.Column(db.Numeric(5, 2), default=0.0)  # Percentage 0-100
    
    # ✅ Carbon emission for sustainability
    carbon_emission = db.Column(db.Numeric(10, 2), default=0.0)  # kg CO2
    
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    def to_dict(self):
        return {
            "id": self.id,
            "floor": self.floor,
            "room": self.room,
            "resource_type": self.resource_type,
            "value": float(self.value) if self.value is not None else None,
            "cost": float(self.cost) if self.cost is not None else None,
            "occupancy_count": self.occupancy_count,
            "occupancy_rate": float(self.occupancy_rate) if self.occupancy_rate is not None else None,
            "carbon_emission": float(self.carbon_emission) if self.carbon_emission is not None else None,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
        }


class Booking(db.Model):
    __tablename__ = "bookings"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    floor = db.Column(db.String(20), nullable=False)
    room_name = db.Column(db.String(50), nullable=False, index=True)
    booked_by = db.Column(db.String(50), nullable=False)
    start_time = db.Column(db.DateTime, nullable=False, index=True)
    end_time = db.Column(db.DateTime, nullable=False, index=True)
    status = db.Column(db.String(20), default="booked")  # booked, cancelled, completed
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # ✅ Excellent addition
    expected_occupants = db.Column(db.Integer, default=1)

    def to_dict(self):
        return {
            "id": self.id,
            "floor": self.floor,
            "room_name": self.room_name,
            "booked_by": self.booked_by,
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "expected_occupants": self.expected_occupants,
        }


class Occupancy(db.Model):
    """Occupancy tracking model - kept separate for analytics"""
    __tablename__ = "occupancy"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    floor = db.Column(db.String(20), nullable=False, index=True)
    room = db.Column(db.String(50))
    occupancy_count = db.Column(db.Integer, nullable=False, default=0)
    occupancy_rate = db.Column(db.Numeric(5, 2))  # Percentage 0-100
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    source = db.Column(db.String(20), default="sensor")  # 'sensor', 'wifi', 'booking', 'estimated'
    confidence = db.Column(db.Numeric(5, 2), default=80.0)
    
    def to_dict(self):
        return {
            "id": self.id,
            "floor": self.floor,
            "room": self.room,
            "occupancy_count": self.occupancy_count,
            "occupancy_rate": float(self.occupancy_rate) if self.occupancy_rate is not None else None,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "source": self.source,
            "confidence": float(self.confidence) if self.confidence is not None else None,
        }


class Anomaly(db.Model):
    __tablename__ = "anomalies"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    floor = db.Column(db.String(20), nullable=False)
    room = db.Column(db.String(50))
    anomaly_type = db.Column(db.String(30), nullable=False)
    message = db.Column(db.Text, nullable=False)
    severity = db.Column(db.String(20), nullable=False, index=True)  # critical, high, medium, low
    status = db.Column(db.String(20), default="pending", index=True)  # pending, acknowledged, resolved
    diagnostics = db.Column(db.Text)  # JSON string
    normal_value = db.Column(db.Numeric(10, 2))
    actual_value = db.Column(db.Numeric(10, 2))
    
    # ✅ Snapshot occupancy at anomaly time
    occupancy_at_time = db.Column(db.Integer, default=0)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    resolved_at = db.Column(db.DateTime)

    def to_dict(self):
        import json

        return {
            "id": self.id,
            "floor": self.floor,
            "room": self.room,
            "anomaly_type": self.anomaly_type,
            "message": self.message,
            "severity": self.severity,
            "status": self.status,
            "diagnostics": json.loads(self.diagnostics) if self.diagnostics else [],
            "normal_value": float(self.normal_value) if self.normal_value is not None else None,
            "actual_value": float(self.actual_value) if self.actual_value is not None else None,
            "occupancy_at_time": self.occupancy_at_time,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "resolved_at": self.resolved_at.isoformat() if self.resolved_at else None,
        }


class Recommendation(db.Model):
    __tablename__ = "recommendations"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    title = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=False)
    category = db.Column(db.String(20), nullable=False, index=True)  # electricity, water, space, manpower, materials
    estimated_savings = db.Column(db.Numeric(10, 2))
    confidence_score = db.Column(db.Numeric(5, 2))
    carbon_impact = db.Column(db.Numeric(10, 2))
    carbon_equivalent = db.Column(db.String(100))
    implemented = db.Column(db.Boolean, default=False, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    implemented_at = db.Column(db.DateTime)
    
    # ✅ Excellent addition
    occupancy_based = db.Column(db.Boolean, default=False)

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "category": self.category,
            "estimated_savings": float(self.estimated_savings) if self.estimated_savings is not None else None,
            "confidence_score": float(self.confidence_score) if self.confidence_score is not None else None,
            "carbon_impact": float(self.carbon_impact) if self.carbon_impact is not None else None,
            "carbon_equivalent": self.carbon_equivalent,
            "implemented": self.implemented,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "implemented_at": self.implemented_at.isoformat() if self.implemented_at else None,
            "occupancy_based": self.occupancy_based,
        }


class KpiHistory(db.Model):
    __tablename__ = "kpi_history"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    month = db.Column(db.Date, nullable=False, unique=True, index=True)
    efficiency_score = db.Column(db.Integer, nullable=False)
    energy_score = db.Column(db.Integer)
    carbon_score = db.Column(db.Integer)
    resource_score = db.Column(db.Integer)
    carbon_footprint = db.Column(db.Numeric(10, 2))
    total_savings = db.Column(db.Numeric(10, 2))
    cost_reduction = db.Column(db.Numeric(5, 2))
    
    # ✅ Excellent additions
    avg_occupancy_rate = db.Column(db.Numeric(5, 2))
    peak_occupancy = db.Column(db.Integer)
    occupancy_efficiency = db.Column(db.Numeric(5, 2))  # Resources per person

    def to_dict(self):
        return {
            "id": self.id,
            "month": self.month.isoformat() if self.month else None,
            "efficiency_score": self.efficiency_score,
            "energy_score": self.energy_score,
            "carbon_score": self.carbon_score,
            "resource_score": self.resource_score,
            "carbon_footprint": float(self.carbon_footprint) if self.carbon_footprint is not None else None,
            "total_savings": float(self.total_savings) if self.total_savings is not None else None,
            "cost_reduction": float(self.cost_reduction) if self.cost_reduction is not None else None,
            "avg_occupancy_rate": float(self.avg_occupancy_rate) if self.avg_occupancy_rate is not None else None,
            "peak_occupancy": self.peak_occupancy,
            "occupancy_efficiency": float(self.occupancy_efficiency) if self.occupancy_efficiency is not None else None,
        }


class SimulationLog(db.Model):
    __tablename__ = "simulation_logs"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_query = db.Column(db.Text, nullable=False)
    scenario_a = db.Column(db.Text)
    scenario_b = db.Column(db.Text)
    scenario_c = db.Column(db.Text)
    recommended_scenario = db.Column(db.String(10))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    current_occupancy = db.Column(db.Integer)
    projected_occupancy = db.Column(db.Integer)

    def to_dict(self):
        import json

        return {
            "id": self.id,
            "user_query": self.user_query,
            "scenario_a": json.loads(self.scenario_a) if self.scenario_a else None,
            "scenario_b": json.loads(self.scenario_b) if self.scenario_b else None,
            "scenario_c": json.loads(self.scenario_c) if self.scenario_c else None,
            "recommended_scenario": self.recommended_scenario,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "current_occupancy": self.current_occupancy,
            "projected_occupancy": self.projected_occupancy,
        }