import csv
import os
from pymongo import MongoClient
from datetime import datetime
import json

# Configuration - Matching application.yml
MONGO_URI = os.getenv("MONGODB_URI", "mongodb://cop:cop_dev_password_change_me@localhost:27017/cop?authSource=admin&uuidRepresentation=standard")
DB_NAME = os.getenv("MONGODB_DB", "cop")

def calculate_age(birth_date):
    if not birth_date:
        return 30
    if isinstance(birth_date, str):
        try:
            birth_date = datetime.fromisoformat(birth_date.replace('Z', ''))
        except:
            return 30
    today = datetime.today()
    return today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))

def get_age_group(age):
    if age < 30: return 'YOUNG_ADULT'
    if age > 60: return 'SENIOR'
    return 'ADULT'

def extract_data():
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    
    print(f"Connecting to database: {DB_NAME}...")
    
    # 1. Fetch Patients
    patients_cursor = db.patients.find({})
    patients_map = {}
    for p in patients_cursor:
        pid = str(p.get('_id'))
        patients_map[pid] = {
            'age': calculate_age(p.get('birth_date')),
            'gender': p.get('gender', 'O'), # Default to O if not present
            'snapshots': [],
            'appointments': []
        }
    
    # 2. Fetch Snapshots
    snapshots_cursor = db.psychological_snapshots.find({})
    for s in snapshots_cursor:
        pid = str(s.get('patientId'))
        if pid in patients_map:
            patients_map[pid]['snapshots'].append(s)
            
    # 3. Fetch Appointments
    apps_cursor = db.appointments.find({'status': 'COMPLETED'})
    for a in apps_cursor:
        pid = str(a.get('patientId'))
        if pid in patients_map:
            patients_map[pid]['appointments'].append(a)

    viz_data = []
    j48_data = []

    # Headers
    viz_headers = [
        'patient_id', 'age', 'gender', 'sentiment_score', 'wellbeing_score', 
        'anxiety_score', 'depression_score', 'sessions_per_month', 
        'days_since_last_session', 'risk_score', 'risk_level'
    ]

    print(f"Processing {len(patients_map)} patients...")

    for pid, data in patients_map.items():
        # Get latest snapshot for current metrics
        snapshots = sorted(data['snapshots'], key=lambda x: x.get('occurredAt', 0), reverse=True)
        if not snapshots:
            continue # Skip patients without clinical data
            
        latest = snapshots[0]
        metrics = latest.get('metrics', {})
        
        wellbeing = metrics.get('wellbeing', 0.5)
        anxiety = metrics.get('anxiety', 0.5)
        depression = metrics.get('depression', 0.5)
        sent_score = latest.get('sentimentScore', 0.0)
        sent_cat = latest.get('predominantSentiment', 'NEUTRAL').upper()
        
        # Calculate attendance
        completed_apps = sorted(data['appointments'], key=lambda x: x.get('startAt', 0), reverse=True)
        sessions_last_month = len([a for a in completed_apps if (datetime.now() - a.get('startAt', datetime.now())).days <= 30])
        
        days_since_last = 30 # Default
        if completed_apps:
            last_app_date = completed_apps[0].get('startAt')
            if last_app_date:
                days_since_last = (datetime.now() - last_app_date).days

        # Calculate Risk (Logic consistent with RelapseService.java)
        risk_score = (anxiety * 0.4 + depression * 0.3 + (1 - wellbeing) * 0.3)
        risk_level = 'HIGH' if risk_score > 0.7 else ('MEDIUM' if risk_score > 0.4 else 'LOW')
        
        # Viz Row
        viz_data.append([
            pid, data['age'], data['gender'], round(sent_score, 2), round(wellbeing, 2),
            round(anxiety, 2), round(depression, 2), sessions_last_month, days_since_last,
            round(risk_score, 2), risk_level
        ])
        
        # J48 Row
        well_cat = 'HIGH' if wellbeing > 0.7 else ('LOW' if wellbeing < 0.3 else 'MEDIUM')
        attendance = 'REGULAR' if sessions_last_month >= 3 else 'IRREGULAR'
        age_grp = get_age_group(data['age'])
        
        j48_data.append([
            data['gender'], age_grp, sent_cat, well_cat, round(anxiety, 2), round(depression, 2),
            attendance, days_since_last, risk_level
        ])

    # Ensure datasets directory exists
    os.makedirs('datasets', exist_ok=True)

    # Save CSV
    with open('datasets/visualization_data.csv', 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(viz_headers)
        writer.writerows(viz_data)

    # Save ARFF
    with open('datasets/relapse_risk_j48.arff', 'w') as f:
        f.write("@RELATION relapse_risk\n\n")
        f.write("@ATTRIBUTE gender {M, F, O}\n")
        f.write("@ATTRIBUTE age_group {YOUNG_ADULT, ADULT, SENIOR}\n")
        f.write("@ATTRIBUTE sentiment {POSITIVE, NEUTRAL, NEGATIVE, MIXED}\n")
        f.write("@ATTRIBUTE wellbeing {HIGH, MEDIUM, LOW}\n")
        f.write("@ATTRIBUTE anxiety NUMERIC\n")
        f.write("@ATTRIBUTE depression NUMERIC\n")
        f.write("@ATTRIBUTE attendance {REGULAR, IRREGULAR}\n")
        f.write("@ATTRIBUTE days_since_last NUMERIC\n")
        f.write("@ATTRIBUTE risk_level {LOW, MEDIUM, HIGH}\n\n")
        f.write("@DATA\n")
        for row in j48_data:
            f.write(",".join(map(str, row)) + "\n")

    print(f"Extraction complete! Generated {len(viz_data)} records from real database.")

if __name__ == "__main__":
    extract_data()
