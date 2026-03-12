import { useQuery } from "@tanstack/react-query";
import { getJson } from "../../api/client";
import { useAuth } from "@shared/auth";

export type DocItem = {
  id: number;
  client_id: number;
  number: string;
  description: string;
  periodStart: string | null;
  periodEnd: string | null;
  sentDate: string | null;
  amount: string;
  due_date: string | null;
  is_open: boolean;
};

export const decompteQueryKeys = {
  all: ["decompte"] as const,
  client: (clientId: string | number) => ["decompte", "client", clientId] as const,
};

function extractRows(raw: unknown): DocItem[] {
  if (Array.isArray(raw)) return raw as DocItem[];
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    for (const key of ['data', 'docs', 'items', 'factures', 'invoices', 'documents']) {
      if (Array.isArray(obj[key])) return obj[key] as DocItem[];
    }
  }
  return [];
}

export function useDecompte(orgId: string | null) {
  const { jwtToken, jwtLoading } = useAuth();

  return useQuery<DocItem[]>({
    queryKey: decompteQueryKeys.client(orgId ?? ''),
    enabled: !!jwtToken && !jwtLoading && !!orgId,
    queryFn: async () => {
      if (!jwtToken) {
        return Promise.reject(new Error("No JWT token available."));
      }
      const raw = await getJson<unknown>(
        `/orgs/${orgId}/proxy/factures`,
        undefined,
        { Authorization: `Bearer ${jwtToken}` },
      );
      return extractRows(raw);
    },
  });
}
