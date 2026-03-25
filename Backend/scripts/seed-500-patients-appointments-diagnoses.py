import os
import random
import sys
import uuid
from datetime import datetime, timedelta, timezone

import psycopg2
import psycopg2.extras
from pymongo import MongoClient


def env(name: str, default: str) -> str:
    val = os.environ.get(name)
    return default if val is None or val.strip() == "" else val.strip()


def main() -> int:
    total = int(env("SEED_TOTAL", "500"))
    dental_count = int(env("SEED_DENTAL_COUNT", str(total // 2)))
    psych_count = total - dental_count

    # Auth credentials (match docker-compose defaults)
    pg_host = env("POSTGRES_HOST", "postgres")
    pg_db = env("POSTGRES_DB", "cop")
    pg_user = env("POSTGRES_USER", "cop")
    pg_password = env("POSTGRES_PASSWORD", "cop_dev_password_change_me")

    mongo_uri = env(
        "MONGODB_URI",
        "mongodb://cop:cop_dev_password_change_me@mongodb:27017/cop?authSource=admin&uuidRepresentation=standard",
    )

    now = datetime.now(timezone.utc)
    started_at = now

    if dental_count <= 0 or psych_count <= 0:
        print(f"Invalid counts. dental_count={dental_count}, psych_count={psych_count}", file=sys.stderr)
        return 2

    rng = random.Random(1337)
    patient_type_by_index: list[str] = (["dental"] * dental_count) + (["psych"] * psych_count)

    # ---------------------------------------------------------------------
    # Postgres: organization/site + professionals
    # ---------------------------------------------------------------------
    pg_conn = psycopg2.connect(
        host=pg_host,
        dbname=pg_db,
        user=pg_user,
        password=pg_password,
    )
    pg_conn.autocommit = False
    try:
        with pg_conn.cursor() as cur:
            cur.execute("select id from organizations limit 1;")
            org_id = cur.fetchone()[0]

            cur.execute("select id, organization_id from sites where organization_id = %s limit 1;", (org_id,))
            site_row = cur.fetchone()
            if not site_row:
                raise RuntimeError("No sites found for organization")
            site_id = site_row[0]

            # Dental + Psych professionals
            cur.execute(
                """
                select id, specialty
                from professionals
                where organization_id = %s
                  and (
                        lower(specialty) like '%%odont%%'
                     or lower(specialty) like '%%psico%%'
                  )
                order by specialty
                """,
                (org_id,),
            )
            pros = cur.fetchall()
            dental_pro_ids = [pid for pid, spec in pros if "odont" in (spec or "").lower()]
            psych_pro_ids = [pid for pid, spec in pros if "psico" in (spec or "").lower()]

            if len(dental_pro_ids) == 0 or len(psych_pro_ids) == 0:
                raise RuntimeError(f"Missing professionals. dental={len(dental_pro_ids)} psych={len(psych_pro_ids)}")

            # Use the first professional from each category.
            # (AppointmentService only checks overlapping per professionalId.)
            dental_prof_id = dental_pro_ids[0]
            psych_prof_id = psych_pro_ids[0]

            # Find latest appointment start times to avoid overlaps with existing data.
            cur.execute(
                "select coalesce(max(start_at), %s) from appointments where professional_id = %s;",
                (now - timedelta(days=365), dental_prof_id),
            )
            dental_max_start = cur.fetchone()[0]

            cur.execute(
                "select coalesce(max(start_at), %s) from appointments where professional_id = %s;",
                (now - timedelta(days=365), psych_prof_id),
            )
            psych_max_start = cur.fetchone()[0]

            # -----------------------------------------------------------------
            # Insert patients
            # -----------------------------------------------------------------
            patient_ids: list[uuid.UUID] = []
            patient_type_by_id: dict[uuid.UUID, str] = {}

            patient_rows = []
            for i in range(total):
                ptype = patient_type_by_index[i]
                patient_id = uuid.uuid4()
                patient_ids.append(patient_id)
                patient_type_by_id[patient_id] = ptype

                # Synthetic demographics
                birth_year = 1970 + (i % 35)  # 1970..2004
                birth_month = 1 + (i % 12)
                birth_day = 1 + (i % 28)
                birth_date = datetime(birth_year, birth_month, birth_day, tzinfo=timezone.utc).date()

                external_code = f"SEED-{ptype.upper()}-{i:04d}"
                full_name = (
                    f"Paciente {ptype.capitalize()} #{i:04d}"
                    if ptype == "dental"
                    else f"Paciente Psicologia #{i:04d}"
                )
                phone = f"+57 300 {1000000 + i}"
                email = f"paciente.{ptype}.{i:04d}@seed.local"

                patient_rows.append(
                    (
                        str(patient_id),
                        str(org_id),
                        str(site_id),
                        external_code,
                        full_name,
                        birth_date,
                        phone,
                        email,
                        "ACTIVE",
                        now,
                        now,
                    )
                )

            insert_patients_sql = """
                insert into patients
                (id, organization_id, site_id, external_code, full_name, birth_date, phone, email, status, created_at, updated_at)
                values %s
            """
            psycopg2.extras.execute_values(cur, insert_patients_sql, patient_rows, page_size=200)

            # -----------------------------------------------------------------
            # Insert appointments (1 per patient)
            # -----------------------------------------------------------------
            # 30-min increments, separate timelines per professional.
            slot_minutes = 30
            dental_slots = 0
            psych_slots = 0

            appt_rows = []
            for i, patient_id in enumerate(patient_ids):
                ptype = patient_type_by_id[patient_id]
                if ptype == "dental":
                    start_at = dental_max_start + timedelta(minutes=(dental_slots + 1) * slot_minutes)
                    dental_slots += 1
                    pro_id = dental_prof_id
                    cat = "Odontologia"
                    name = "Consulta de diagnostico, plan de tratamiento y recomendaciones preventivas."
                    reason = f"Odontologia seed {i:04d}"
                else:
                    start_at = psych_max_start + timedelta(minutes=(psych_slots + 1) * slot_minutes)
                    psych_slots += 1
                    pro_id = psych_prof_id
                    cat = "Psicologia"
                    name = "Consulta psicologica inicial"
                    reason = f"Psicologia seed {i:04d}"

                end_at = start_at + timedelta(minutes=slot_minutes)
                appt_id = uuid.uuid4()

                appt_rows.append(
                    (
                        str(appt_id),
                        str(org_id),
                        str(site_id),
                        str(pro_id),
                        str(patient_id),
                        start_at,
                        end_at,
                        "REQUESTED",
                        reason,
                        None,  # service_offering_id
                        name,
                        cat,
                        0,  # version
                        now,
                        now,
                    )
                )

            insert_appt_sql = """
                insert into appointments
                (id, organization_id, site_id, professional_id, patient_id, start_at, end_at, status, reason,
                 service_offering_id, service_name_snapshot, service_category_snapshot, version, created_at, updated_at)
                values %s
            """
            psycopg2.extras.execute_values(cur, insert_appt_sql, appt_rows, page_size=200)

            pg_conn.commit()
    except Exception:
        pg_conn.rollback()
        raise
    finally:
        pg_conn.close()

    # ---------------------------------------------------------------------
    # Mongo: diagnosis_results / diagnostic_images / psychological_snapshots
    # ---------------------------------------------------------------------
    mongo = MongoClient(mongo_uri)
    db = mongo.get_database("cop")

    # Collections (Spring Data names)
    images_col = db["diagnostic_images"]
    results_col = db["diagnosis_results"]
    psych_col = db["psychological_snapshots"]

    findings_labels = [
        "CARIES",
        "INFECTION",
        "WEAR",
        "FRACTURE",
        "PERIAPICAL_LESION",
        "HEALTHY",
    ]

    model_version = "seed-efficientnet-v1"

    image_docs = []
    result_docs = []
    psych_docs = []

    # Deterministic distinct values per patient
    for idx, patient_id in enumerate(patient_ids):
        # Make each patient's seed unique but deterministic.
        patient_rng = random.Random(10000 + idx)
        ptype = patient_type_by_id[patient_id]

        if ptype == "dental":
            image_id = uuid.uuid4()
            # Ensure at least one non-HEALTHY finding per patient.
            num_findings = 2 + (idx % 3)  # 2..4
            non_healthy_labels = [l for l in findings_labels if l != "HEALTHY"]
            primary = patient_rng.choice(non_healthy_labels)

            chosen_labels = [primary]
            while len(chosen_labels) < num_findings:
                chosen_labels.append(patient_rng.choice(findings_labels))

            chosen_labels = list(dict.fromkeys(chosen_labels))  # preserve order, remove dups
            while len(chosen_labels) < num_findings:
                chosen_labels.append(patient_rng.choice(findings_labels))

            findings = []
            for j, label in enumerate(chosen_labels):
                confidence = round(patient_rng.uniform(0.45, 0.98), 4)
                description = f"Seed finding {label} for patient index {idx:04d}"
                # boundingBox is optional; we add it to have richer data.
                bbox = [
                    round(patient_rng.uniform(0, 1), 4),
                    round(patient_rng.uniform(0, 1), 4),
                    round(patient_rng.uniform(0, 1), 4),
                    round(patient_rng.uniform(0, 1), 4),
                ]
                findings.append(
                    {
                        "label": label,
                        "confidence": confidence,
                        "description": description,
                        "boundingBox": bbox,
                    }
                )

            # Diagnostic image doc (minimal)
            grid_fs_file_id = f"seed-gridfs-{image_id}"
            filename = f"seed-image-{idx:04d}.png"
            content_type = "image/png"

            image_docs.append(
                {
                    "id": image_id,
                    "organizationId": org_id,
                    "siteId": site_id,
                    "patientId": patient_id,
                    "gridFsFileId": grid_fs_file_id,
                    "filename": filename,
                    "contentType": content_type,
                    "status": "COMPLETED",
                    "createdAt": now,
                }
            )

            result_docs.append(
                {
                    "id": uuid.uuid4(),
                    "organizationId": org_id,
                    "siteId": site_id,
                    "patientId": patient_id,
                    "imageId": image_id,
                    "findings": findings,
                    "modelVersion": model_version,
                    "processingTimeMs": int(patient_rng.uniform(250, 2200)),
                    "status": "COMPLETED",
                    "createdAt": now - timedelta(seconds=(total - idx)),
                }
            )
        else:
            # Psychology snapshot
            metrics = {
                "wellbeing": round(patient_rng.uniform(0.05, 0.95), 4),
                "anxiety": round(patient_rng.uniform(0.05, 0.95), 4),
                "depression": round(patient_rng.uniform(0.05, 0.95), 4),
                "stress": round(patient_rng.uniform(0.05, 0.95), 4),
            }

            sentiment_options = ["positive", "neutral", "negative", "mixed"]
            predominant_sentiment = patient_rng.choice(sentiment_options)
            sentiment_score = round(patient_rng.uniform(-1.0, 1.0), 4)

            high_risk = patient_rng.random() < 0.35
            risk_details = (
                f"Seed high risk snapshot #{idx:04d} (stress/anxiety elevated)"
                if high_risk
                else "Seed low/normal risk snapshot"
            )

            psych_docs.append(
                {
                    "id": uuid.uuid4(),
                    "organizationId": org_id,
                    "siteId": site_id,
                    "patientId": patient_id,
                    "occurredAt": now - timedelta(minutes=idx),
                    "metrics": metrics,
                    "predominantSentiment": predominant_sentiment,
                    "sentimentScore": sentiment_score,
                    "highRiskAlert": high_risk,
                    "riskDetails": risk_details,
                    "source": "SEED_API",
                    "sourceId": uuid.uuid4(),
                }
            )

    # Bulk insert
    if image_docs:
        images_col.insert_many(image_docs, ordered=False)
    if result_docs:
        results_col.insert_many(result_docs, ordered=False)
    if psych_docs:
        psych_col.insert_many(psych_docs, ordered=False)

    elapsed = (datetime.now(timezone.utc) - started_at).total_seconds()
    print(f"Seed complete: total={total}, dental={dental_count}, psych={psych_count}, elapsed_seconds={elapsed:.2f}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

