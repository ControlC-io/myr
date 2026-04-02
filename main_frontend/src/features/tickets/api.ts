import { postJson, getJson } from "../../api/client";
import type {
  Ticket,
  TicketListApiResponse,
  TicketListParams,
  TicketListPayload,
} from "./types";

const TICKETS_PROXY_PATH = (orgId: string) => `/orgs/${orgId}/proxy/tickets`;
const TICKETS_CREATE_PATH = (orgId: string) => `/orgs/${orgId}/proxy/tickets/create`;

export async function fetchTickets(
  params: TicketListParams,
  jwtToken: string,
): Promise<TicketListApiResponse> {
  const { orgId, ...pagination } = params;
  const payload = await postJson<typeof pagination, TicketListPayload>(
    TICKETS_PROXY_PATH(orgId),
    pagination,
    {
      Authorization: `Bearer ${jwtToken}`,
    },
  );

  const list: Ticket[] = payload.ticket?.data ?? [];

  return {
    data: list,
  };
}

export interface CreateTicketPayload {
  ticalContactId: number;
  userEmail: string;
  title: string;
  description?: string;
  followupContacts?: string;
}

export async function fetchTicketById(
  orgId: string,
  ticketId: number,
  jwtToken: string,
): Promise<{ ticket: Ticket | null }> {
  return getJson<{ ticket: Ticket | null }>(
    `/orgs/${orgId}/proxy/tickets/${ticketId}`,
    undefined,
    { Authorization: `Bearer ${jwtToken}` },
  );
}

export async function createTicket(
  orgId: string,
  payload: CreateTicketPayload,
  jwtToken: string,
): Promise<{ id?: number }> {
  return postJson<CreateTicketPayload, { id?: number }>(
    TICKETS_CREATE_PATH(orgId),
    payload,
    { Authorization: `Bearer ${jwtToken}` },
  );
}

