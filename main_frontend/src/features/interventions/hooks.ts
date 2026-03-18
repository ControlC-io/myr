import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@shared/auth";
import type { InterventionsParams, InterventionsPayload } from "./types";
import { fetchInterventions } from "./api";

export const interventionsQueryKeys = {
  all: ["interventions"] as const,
  list: (params: InterventionsParams) =>
    ["interventions", "list", params] as const,
};

export function useInterventions(params: InterventionsParams) {
  const { jwtToken, jwtLoading } = useAuth();

  return useQuery<InterventionsPayload>({
    queryKey: interventionsQueryKeys.list(params),
    enabled: !!jwtToken && !jwtLoading && !!params.orgId,
    queryFn: () => {
      if (!jwtToken) {
        return Promise.reject(
          new Error("No JWT token available. Please log out and log in again."),
        );
      }
      return fetchInterventions(params, jwtToken);
    },
  });
}
