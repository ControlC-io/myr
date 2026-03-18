import { useQuery } from "@tanstack/react-query";
import { postJson } from "../../api/client";
import { useAuth } from "@shared/auth";

export interface ServiceItem {
  id: number | string;
  name: string | null;
  type: string | null;
  status: string | null;
  date_start: string | null;
  date_end: string | null;
  [key: string]: unknown;
}

export const servicesQueryKeys = {
  all: ["services"] as const,
  client: (orgId: string) => ["services", "client", orgId] as const,
};

function extractRows(raw: unknown): ServiceItem[] {
  if (Array.isArray(raw)) return raw as ServiceItem[];
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const data = obj["data"];
    if (Array.isArray(data)) return data as ServiceItem[];
    if (data && typeof data === "object" && !Array.isArray(data)) {
      return Object.values(data as Record<string, unknown>) as ServiceItem[];
    }
    for (const key of ["services", "items", "list", "contracts"]) {
      if (Array.isArray(obj[key])) return obj[key] as ServiceItem[];
    }
  }
  return [];
}

export function useServices(orgId: string | null) {
  const { jwtToken, jwtLoading } = useAuth();

  return useQuery<ServiceItem[]>({
    queryKey: servicesQueryKeys.client(orgId ?? ""),
    enabled: !!jwtToken && !jwtLoading && !!orgId,
    queryFn: async () => {
      if (!jwtToken) {
        return Promise.reject(new Error("No JWT token available."));
      }
      const raw = await postJson<Record<string, never>, unknown>(
        `/orgs/${orgId}/proxy/services`,
        {},
        { Authorization: `Bearer ${jwtToken}` },
      );
      return extractRows(raw);
    },
  });
}
