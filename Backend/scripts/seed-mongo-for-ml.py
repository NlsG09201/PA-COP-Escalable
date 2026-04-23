import random
from pymongo import MongoClient
from datetime import datetime, timedelta
import uuid
import os

MONGO_URI = os.getenv("MONGODB_URI", "mongodb://cop:cop_dev_password_change_me@localhost:27017/cop?authSource=admin&uuidRepresentation=standard")
DB_NAME = os.getenv("MONGODB_DB", "cop")

def seed_real_data():
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    
    # Clean existing test data if needed (optional)
    # db.patients.delete_many({"is_test": True})
    
    org_id = uuid.uuid4()
    site_id = uuid.uuid4()
    
    num_patients = 100
    print(f"Seeding {num_patients} patients and clinical data into MongoDB...")

    for i in range(num_patients):
        p_id = uuid.uuid4()
        birth_date = datetime.now() - timedelta(days=random.randint(18*365, 70*365))
        
        # 1. Create Patient
        patient = {
            "_id": p_id,
            "organizationId": org_id,
            "siteId": site_id,
            "full_name": f"Paciente Test {i}",
            "birth_date": birth_date,
            "gender": random.choice(['M', 'F', 'O']),
            "is_test": True
        }
        db.patients.insert_one(patient)
        
        # 2. Create Snapshots (Mental evolution)
        mental_state = random.random()
        for j in range(random.randint(2, 5)):
            wellbeing = max(0, min(1, mental_state + (random.random() - 0.5) * 0.2))
            anxiety = max(0, min(1, (1 - mental_state) + (random.random() - 0.5) * 0.2))
            depression = max(0, min(1, (1 - mental_state) * 0.8 + (random.random() - 0.5) * 0.2))
            
            snapshot = {
                "patientId": p_id,
                "organizationId": org_id,
                "siteId": site_id,
                "occurredAt": datetime.now() - timedelta(days=j*7),
                "metrics": {
                    "wellbeing": wellbeing,
                    "anxiety": anxiety,
                    "depression": depression
                },
                "predominantSentiment": random.choice(['POSITIVE', 'NEUTRAL', 'NEGATIVE', 'MIXED']),
                "sentimentScore": (mental_state * 2 - 1),
                "source": "SESSION_NOTES"
            }
            db.psychological_snapshots.insert_one(snapshot)
            
        # 3. Create Appointments
        for j in range(random.randint(1, 4)):
            db.appointments.insert_one({
                "patientId": p_id,
                "organizationId": org_id,
                "siteId": site_id,
                "startAt": datetime.now() - timedelta(days=random.randint(1, 30)),
                "status": "COMPLETED"
            })

    print("Seeding complete! Now run 'python Backend/scripts/extract-mongo-data.py' to generate datasets.")

if __name__ == "__main__":
    try:
        seed_real_data()
    except Exception as e:
        print(f"Error connecting to MongoDB: {e}")
        print("Make sure your MongoDB service is running and credentials are correct.")
