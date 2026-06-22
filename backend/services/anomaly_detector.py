import json
from datetime import datetime, timedelta

import pandas as pd
from sklearn.ensemble import IsolationForest

from models import Anomaly, Resource, db


def _diagnostics_for(anomaly_type):
    options = {
        "energy_spike": [
            "Abnormal electricity consumption detected",
            "Possible HVAC or equipment malfunction",
            "Investigate power-intensive systems",
        ],
        "water_leak": [
            "Unusual water consumption pattern detected",
            "Possible leak or valve issue",
            "Recommend plumbing inspection",
        ],
        "overnight_usage": [
            "Resource usage detected during low occupancy period",
            "Equipment may have been left running",
            "Review automation schedules",
        ],
        "equipment_failure": [
            "Irregular equipment behaviour detected",
            "Maintenance inspection recommended",
        ],
    }

    return options.get(
        anomaly_type,
        ["Further investigation recommended"],
    )


def detect_anomalies():

    since = datetime.utcnow() - timedelta(days=30)

    rows = (
        Resource.query.filter(
            Resource.timestamp >= since
        )
        .order_by(Resource.timestamp.asc())
        .all()
    )

    if len(rows) < 100:
        return []

    data = []

    for r in rows:

        data.append(
            {
                "floor": r.floor,
                "room": r.room,
                "resource_type": r.resource_type,
                "timestamp": r.timestamp,
                "value": float(r.value),
                "occupancy_count": float(
                    r.occupancy_count or 0
                ),
                "occupancy_rate": float(
                    r.occupancy_rate or 0
                ),
                "carbon_emission": float(
                    r.carbon_emission or 0
                ),
                "hour": r.timestamp.hour,
                "weekday": r.timestamp.weekday(),
            }
        )

    df = pd.DataFrame(data)

    features = [
        "value",
        "occupancy_count",
        "occupancy_rate",
        "carbon_emission",
        "hour",
        "weekday",
    ]

    model = IsolationForest(
        contamination=0.002,
        random_state=42,
    )

    df["prediction"] = model.fit_predict(
        df[features]
    )

    anomalies = df[
        df["prediction"] == -1
    ]

    print(
        f"Isolation Forest found "
        f"{len(anomalies)} candidate anomalies"
    )

    created = []

    for _, row in anomalies.iterrows():

        existing = (
            Anomaly.query.filter_by(
                floor=row["floor"],
                created_at=row["timestamp"],
            ).first()
        )

        if existing:
            continue

        floor_data = df[
            (df["floor"] == row["floor"])
            &
            (
                df["resource_type"]
                ==
                row["resource_type"]
            )
        ]

        floor_mean = float(
            floor_data["value"].median()
        )

        value = float(row["value"])

        resource_type = row["resource_type"]

        # ----------------------------------
        # BUSINESS VALIDATION LAYER
        # ----------------------------------

        ratio = value / floor_mean if floor_mean > 0 else 0

        if resource_type == "electricity":

            if ratio < 1.20:
                continue

            anomaly_type = "energy_spike"

            if ratio >= 3:
                severity = "critical"

            elif ratio >= 2:
                severity = "high"

            else:
                severity = "medium"

        else:

            # Water anomalies should be stricter
            if ratio < 1.30:
                continue

            anomaly_type = "water_leak"

            if ratio >= 2.5:
                severity = "critical"

            elif ratio >= 1.8:
                severity = "high"

            else:
                severity = "medium"

        # ----------------------------------
        # OVERNIGHT USAGE DETECTION
        # ----------------------------------

        if (
            row["occupancy_rate"] < 15
            and (
                row["hour"] < 6
                or row["hour"] >= 22
            )
            and value > floor_mean
        ):

            anomaly_type = "overnight_usage"
            severity = "medium"

        anomaly = Anomaly(
            floor=row["floor"],
            room=row["room"],
            anomaly_type=anomaly_type,
            message=(
                f"{resource_type.title()} usage reached "
                f"{ratio:.1f}x the normal floor baseline."
            ),
            severity=severity,
            status="pending",
            diagnostics=json.dumps(
                _diagnostics_for(
                    anomaly_type
                )
            ),
            normal_value=round(
                floor_mean,
                2,
            ),
            actual_value=round(
                value,
                2,
            ),
            occupancy_at_time=int(
                row["occupancy_count"]
            ),
            created_at=row["timestamp"],
        )

        db.session.add(anomaly)

        created.append(anomaly)

    if created:
        db.session.commit()

    print(
        f"Business validation confirmed "
        f"{len(created)} anomalies"
    )

    return created