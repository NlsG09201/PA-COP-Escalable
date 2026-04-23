import csv
import random
import os

def generate_datasets():
    num_samples = 15000
    risk_levels = ['LOW', 'MEDIUM', 'HIGH']
    sentiments = ['POSITIVE', 'NEUTRAL', 'NEGATIVE']
    attendance_types = ['REGULAR', 'IRREGULAR']

    viz_data = []
    j48_data = []

    # Headers for Visualization
    viz_headers = [
        'patient_id', 'age', 'gender', 'sentiment_score', 'wellbeing_score', 
        'anxiety_score', 'depression_score', 'sessions_per_month', 
        'days_since_last_session', 'risk_score', 'risk_level'
    ]

    # J48 categorical headers (for CSV version)
    j48_headers = [
        'sentiment_cat', 'wellbeing_cat', 'anxiety_score', 'depression_score',
        'attendance', 'days_since_last', 'risk_level'
    ]

    for i in range(num_samples):
        # Generate base features
        patient_id = f"PAT-{1000 + i}"
        age = random.randint(18, 75)
        gender = random.choice(['M', 'F', 'O'])
        
        # Correlated values
        # We'll base everything on a hidden "mental_state" factor from 0 (bad) to 1 (good)
        mental_state = random.random()
        
        # Add some noise
        noise = (random.random() - 0.5) * 0.2
        wellbeing_score = max(0, min(1, mental_state + noise))
        
        sentiment_score = max(-1, min(1, (mental_state * 2 - 1) + noise))
        
        anxiety_score = max(0, min(1, (1 - mental_state) + noise))
        depression_score = max(0, min(1, (1 - mental_state) * 0.8 + noise))
        
        sessions_per_month = random.randint(1, 4) if mental_state > 0.3 else random.randint(0, 2)
        days_since_last = random.randint(1, 14) if mental_state > 0.4 else random.randint(10, 30)
        
        # Calculate risk score (0 to 1, where 1 is high risk)
        risk_score = (anxiety_score * 0.4 + depression_score * 0.3 + (1 - wellbeing_score) * 0.3)
        
        if risk_score > 0.7:
            risk_level = 'HIGH'
        elif risk_score > 0.4:
            risk_level = 'MEDIUM'
        else:
            risk_level = 'LOW'

        # Visualization Data
        viz_row = [
            patient_id, age, gender, 
            round(sentiment_score, 2), round(wellbeing_score, 2),
            round(anxiety_score, 2), round(depression_score, 2),
            sessions_per_month, days_since_last, 
            round(risk_score, 2), risk_level
        ]
        viz_data.append(viz_row)

        # J48 Data (Categorical mappings)
        sent_cat = 'POSITIVE' if sentiment_score > 0.2 else ('NEGATIVE' if sentiment_score < -0.2 else 'NEUTRAL')
        well_cat = 'HIGH' if wellbeing_score > 0.7 else ('LOW' if wellbeing_score < 0.3 else 'MEDIUM')
        attendance = 'REGULAR' if sessions_per_month >= 3 else 'IRREGULAR'
        
        # New demographic categories for J48
        age_group = 'YOUNG_ADULT' if age < 30 else ('SENIOR' if age > 60 else 'ADULT')
        
        j48_row = [
            gender, age_group, sent_cat, well_cat, round(anxiety_score, 2), round(depression_score, 2),
            attendance, days_since_last, risk_level
        ]
        j48_data.append(j48_row)

    # Save Visualization CSV
    with open('datasets/visualization_data.csv', 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(viz_headers)
        writer.writerows(viz_data)

    # Save J48 ARFF
    with open('datasets/relapse_risk_j48.arff', 'w') as f:
        f.write("@RELATION relapse_risk\n\n")
        f.write("@ATTRIBUTE gender {M, F, O}\n")
        f.write("@ATTRIBUTE age_group {YOUNG_ADULT, ADULT, SENIOR}\n")
        f.write("@ATTRIBUTE sentiment {POSITIVE, NEUTRAL, NEGATIVE}\n")
        f.write("@ATTRIBUTE wellbeing {HIGH, MEDIUM, LOW}\n")
        f.write("@ATTRIBUTE anxiety NUMERIC\n")
        f.write("@ATTRIBUTE depression NUMERIC\n")
        f.write("@ATTRIBUTE attendance {REGULAR, IRREGULAR}\n")
        f.write("@ATTRIBUTE days_since_last NUMERIC\n")
        f.write("@ATTRIBUTE risk_level {LOW, MEDIUM, HIGH}\n\n")
        f.write("@DATA\n")
        for row in j48_data:
            f.write(",".join(map(str, row)) + "\n")

    print("Datasets generated successfully in /datasets folder.")

if __name__ == "__main__":
    generate_datasets()
