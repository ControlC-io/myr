import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@shared/auth";
import type { Ticket, TicketListParams, TicketListApiResponse } from "./types";
import { fetchTickets, fetchTicketById } from "./api";

export const ticketsQueryKeys = {
  all: ["tickets"] as const,
  list: (params: TicketListParams) => ["tickets", "list", params] as const,
  byId: (orgId: string, ticketId: number) => ["tickets", "byId", orgId, ticketId] as const,
};

export function useTickets(params: TicketListParams) {
  const { jwtToken, jwtLoading } = useAuth();

  return useQuery<TicketListApiResponse>({
    queryKey: ticketsQueryKeys.list(params),
    enabled: !!jwtToken && !jwtLoading && !!params.orgId,
    queryFn: () => {
      if (!jwtToken) {
        return Promise.reject(
          new Error("No JWT token available. Please log out and log in again."),
        );
      }
      return fetchTickets(params, jwtToken);
    },
    keepPreviousData: true,
  });
}

export function useTicketById(orgId: string | null, ticketId: number | null) {
  const { jwtToken, jwtLoading } = useAuth();

  return useQuery<{ ticket: Ticket | null }>({
    queryKey: ticketsQueryKeys.byId(orgId ?? "", ticketId ?? 0),
    enabled: !!jwtToken && !jwtLoading && !!orgId && !!ticketId,
    queryFn: () => {
      if (!jwtToken || !orgId || !ticketId) {
        return Promise.reject(new Error("Missing required params"));
      }
      return fetchTicketById(orgId, ticketId, jwtToken);
    },
  });
}


