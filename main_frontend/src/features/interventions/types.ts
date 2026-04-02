export interface InterventionItem {
  date_begin: string;
  date_end: string | null;
  desc_facturation: string | null;
  heure_precise: number;
  id: number;
  id_tracking: number;
  non_facturable: number;
  preste: number;
}

export interface InterventionsResult {
  total: number;
  data: InterventionItem[];
  paginPage: number;
  pageSize: number;
}

export interface InterventionsParams {
  orgId: string;
  dateBegin?: string;
  paginPage?: number;
  pageSize?: number;
}

export interface InterventionsPayload {
  intervention: InterventionsResult | null;
}
