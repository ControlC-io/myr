export interface InterventionsResult {
  total: number;
}

export interface InterventionsParams {
  orgId: string;
  dateBegin?: string;
}

export interface InterventionsPayload {
  intervention: InterventionsResult | null;
}
