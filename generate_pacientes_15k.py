import pandas as pd
import random
from datetime import datetime, timedelta

# Number of patient records to generate
N = 15000

# Example data for generating realistic records
departamentos = ['Antioquia', 'Cundinamarca', 'Valle del Cauca', 'Bogotá', 'Atlántico', 'Santander', 'Bolívar']

tipo_ips = ['Hospital', 'Clínica', 'Centro de Salud', 'Urgencias']
regimen = ['Contributivo', 'Subsidiado']
estado_egreso = ['Al día', 'Fallecido', 'Transferido', 'Dado de alta']

# Function to generate a random fecha_ingreso
def random_fecha_ingreso():
    start = datetime(2020, 1, 1)
    end = datetime(2026, 4, 18)
    return start + timedelta(days=random.randint(0, (end - start).days))

# Function to generate patient records
patient_records = []
for _ in range(N):
    id_paciente = f'P-{random.randint(100000, 999999)}'
    fecha_ingreso = random_fecha_ingreso().strftime('%Y-%m-%d')
    departamento = random.choice(departamentos)
    tipo_ip = random.choice(tipo_ips)
    edad = random.randint(0, 100)
    genero = random.choice(['Masculino', 'Femenino'])
    motivo_ingreso = random.choice(['Enfermedad', 'Accidente', 'Consulta de rutina', 'Cirugía'])
    regimen = random.choice(regimen)
    monto_ingreso = round(random.uniform(1000, 10000), 2)
    dias_hospitalizacion = random.randint(1, 30)
    fecha_egreso = (datetime.strptime(fecha_ingreso, '%Y-%m-%d') + timedelta(days=dias_hospitalizacion)).strftime('%Y-%m-%d')
    estado_egreso_value = random.choice(estado_egreso)

    patient_records.append([
id_paciente, fecha_ingreso, departamento, tipo_ip, edad, genero, motivo_ingreso,
     regimen, monto_ingreso, dias_hospitalizacion, fecha_egreso, estado_egreso_value
    ])

# Create a DataFrame and append to existing CSV
columns = ['id_paciente', 'fecha_ingreso', 'departamento', 'tipo_ips', 'edad', 'genero', 'motivo_ingreso', 'regimen', 'monto_ingreso', 'dias_hospitalizacion', 'fecha_egreso', 'estado_egreso']
pacientes_df = pd.DataFrame(patient_records, columns=columns)

# Load existing data if exists and append new data
try:
    existing_data = pd.read_csv('pacientes_colombia_15k.csv')
    combined_data = pd.concat([existing_data, pacientes_df], ignore_index=True)
except FileNotFoundError:
    combined_data = pacientes_df

# Save the combined data to CSV
combined_data.to_csv('pacientes_colombia_15k.csv', index=False)
