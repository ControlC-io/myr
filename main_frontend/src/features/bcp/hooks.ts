import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@shared/auth";
import { getJson } from "../../api/client";
import type { BcpBooking } from "./types";

export const bcpQueryKeys = {
  all: ["bcp"] as const,
  bookings: (orgId: string) => ["bcp", "bookings", orgId] as const,
};

export const useBcpBookings = (orgId: string | null) => {
  const { jwtToken, jwtLoading } = useAuth();

  return useQuery({
    queryKey: bcpQueryKeys.bookings(orgId ?? ""),
    queryFn: async () => {
      const data = await getJson<BcpBooking[]>(
        `/orgs/${orgId}/proxy/bcp-bookings`,
        undefined,
        { Authorization: `Bearer ${jwtToken}` }
      );
      return data;
    },
    enabled: !!orgId && !!jwtToken && !jwtLoading,
  });
};
