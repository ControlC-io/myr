import type { ApiListResponse } from "../../api/types";

export type TicketStatus =
  | "open"
  | "in_progress"
  | "resolved"
  | "closed";

export interface TicketCategory {
  name: string;
}

export interface TicketUser {
  realname?: string;
  firstname?: string;
}

export interface TicketGroup {
  name?: string;
}

export interface TicketIntervention {
  non_facturable?: boolean | number;
  desc_facturation?: string | null;
  preste?: string | null;
  date_begin?: string | null;
}

export interface TicketSupplier {
  id: number;
}

export interface Ticket {
  id: number;
  name: string;
  content?: string;
  status?: TicketStatus | string;
  date?: string;
  solvedate?: string | null;
  intervention_date?: string | null;
  is_cyber_incident?: boolean;
  priority_v2?: string | null;
  tical_numero_prj?: string | null;
  ticketcategories?: TicketCategory[];
  user_assign?: TicketUser | null;
  group_assign?: TicketGroup | null;
  interventions?: TicketIntervention[];
  supplier?: TicketSupplier | null;
}

export interface TicketListParams {
  orgId: string;
  paginLimit?: number;
  paginPage?: number;
  orderByDesc?: string;
}

export interface TicketListPayload {
  ticket: {
    data: Ticket[];
  };
}

export type TicketListApiResponse = ApiListResponse<Ticket>;

