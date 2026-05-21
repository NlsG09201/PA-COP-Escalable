"""Genera pacientes_colombia_15k.csv con N filas (por defecto 15000)."""
import random
from datetime import datetime, timedelta

N = 15000

departamentos = [
    'Antioquia', 'Bogotá D.C.', 'Valle del Cauca', 'Cundinamarca', 'Atlántico',
    'Santander', 'Bolívar', 'Caldas', 'Nariño', 'Meta',
]

tipo_ips = ['Hospital', 'Clínica', 'Centro de Salud', 'Urgencias']
regimen_opts = ['Contributivo', 'Subsidiado']
estado_egreso = ['Recuperado', 'Fallecido', 'Transferido', 'Alta']
motivos = ['Enfermedad', 'Accidente', 'Consulta de rutina', 'Cirugía', 'Chequeo', 'Emergencia']


def random_fecha_ingreso():
    start = datetime(2020, 1, 1)
    end = datetime(2026, 4, 18)
    return start + timedelta(days=random.randint(0, (end - start).days))


rows = []
for i in range(1, N + 1):
    id_paciente = f'P-{100000 + i}'
    fecha_ingreso = random_fecha_ingreso()
    dias = random.randint(1, 30)
    fecha_egreso = fecha_ingreso + timedelta(days=dias)
    rows.append([
        id_paciente,
        fecha_ingreso.strftime('%Y-%m-%d'),
        random.choice(departamentos),
        random.choice(tipo_ips),
        random.randint(0, 100),
        random.choice(['M', 'F']),
        random.choice(motivos),
        random.choice(regimen_opts),
        round(random.uniform(1000, 10000), 2),
        dias,
        fecha_egreso.strftime('%Y-%m-%d'),
        random.choice(estado_egreso),
    ])

columns = [
    'id_paciente', 'fecha_ingreso', 'departamento', 'tipo_ips', 'edad', 'genero',
    'motivo_ingreso', 'regimen', 'monto_ingreso', 'dias_hospitalizacion',
    'fecha_egreso', 'estado_egreso',
]

try:
    import pandas as pd
    pd.DataFrame(rows, columns=columns).to_csv('pacientes_colombia_15k.csv', index=False)
except ImportError:
    import csv
    with open('pacientes_colombia_15k.csv', 'w', newline='', encoding='utf-8') as f:
        w = csv.writer(f)
        w.writerow(columns)
        w.writerows(rows)

print(f'Escrito pacientes_colombia_15k.csv con {N} filas')
