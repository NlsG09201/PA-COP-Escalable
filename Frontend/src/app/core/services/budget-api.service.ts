import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';

export interface BudgetPhaseItem {
  id: string;
  description: string;
  unitCost: number;
  quantity: number;
  subtotal: number;
  category: string;
}

export interface BudgetPhase {
  id: string;
  phaseName: string;
  phaseOrder: number;
  items: BudgetPhaseItem[];
  phaseTotal: number;
}

export interface ClinicalBudget {
  id: string;
  patientId: string;
  treatmentPlanId: string;
  phases: BudgetPhase[];
  totalAmount: number;
  currency: string;
  status: string;
  approvedAt?: string;
  createdAt: string;
}

export interface PaymentInstallment {
  installmentNumber: number;
  amount: number;
  dueDate: string;
  status: string;
}

export interface PaymentPlan {
  id: string;
  budgetId: string;
  planType: string;
  totalAmount: number;
  installments: PaymentInstallment[];
  interestRate: number;
  createdAt: string;
}

export interface PaymentSimulation {
  planType: string;
  installmentCount: number;
  interestRate: number;
  totalWithInterest: number;
  installments: PaymentInstallment[];
}

@Injectable({ providedIn: 'root' })
export class BudgetApiService {
  constructor(private readonly http: HttpClient) {}

  generateFromPlan$(patientId: string, treatmentPlanId: string): Observable<ClinicalBudget> {
    return this.http.post<ClinicalBudget>(`${API_BASE_URL}/api/budget/patients/${patientId}/generate`, { treatmentPlanId });
  }

  getBudgets$(patientId: string): Observable<ClinicalBudget[]> {
    return this.http.get<ClinicalBudget[]>(`${API_BASE_URL}/api/budget/patients/${patientId}`);
  }

  getBudget$(budgetId: string): Observable<ClinicalBudget> {
    return this.http.get<ClinicalBudget>(`${API_BASE_URL}/api/budget/${budgetId}`);
  }

  approveBudget$(budgetId: string): Observable<ClinicalBudget> {
    return this.http.post<ClinicalBudget>(`${API_BASE_URL}/api/budget/${budgetId}/approve`, {});
  }

  simulatePayment$(budgetId: string, planType: string, installments: number, interestRate: number): Observable<PaymentSimulation> {
    return this.http.post<PaymentSimulation>(`${API_BASE_URL}/api/budget/${budgetId}/simulate-payment`, {
      planType,
      installments,
      interestRate
    });
  }
}
