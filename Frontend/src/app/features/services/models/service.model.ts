export type ServiceCategory = 'ODONTOLOGIA' | 'PSICOLOGIA';

export type ServiceSort = 'name_asc' | 'price_asc' | 'price_desc';

export interface ServiceItem {
  id: string;
  name: string;
  description: string;
  category: ServiceCategory;
  price: number;
  duration: number | null;
  active: boolean;
  createdAt: string;
}

export interface ServiceQuery {
  category: ServiceCategory | 'ALL';
  search: string;
  sort: ServiceSort;
}

export interface UpsertServicePayload {
  name: string;
  description: string;
  category: ServiceCategory;
  price: number;
  duration: number | null;
}
