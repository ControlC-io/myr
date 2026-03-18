import { useQuery } from "@tanstack/react-query";
import { postJson } from "../../api/client";
import { useAuth } from "@shared/auth";

export type OfferItem = {
  id: number | string;
  reference: string | null;
  date: string | null;
  description: string | null;
  status: string | null;
  amount: string | null;
  [key: string]: unknown;
};

export const offersQueryKeys = {
  all: ["offers"] as const,
  client: (orgId: string) => ["offers", "client", orgId] as const,
};

function extractRows(raw: unknown): OfferItem[] {
  if (Array.isArray(raw)) return raw as OfferItem[];
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    for (const key of ["data", "offers", "items", "list", "documents"]) {
      if (Array.isArray(obj[key])) return obj[key] as OfferItem[];
    }
  }
  return [];
}

export function useOffers(orgId: string | null) {
  const { jwtToken, jwtLoading } = useAuth();

  return useQuery<OfferItem[]>({
    queryKey: offersQueryKeys.client(orgId ?? ""),
    enabled: !!jwtToken && !jwtLoading && !!orgId,
    queryFn: async () => {
      if (!jwtToken) {
        return Promise.reject(new Error("No JWT token available."));
      }
      const raw = await postJson<Record<string, never>, unknown>(
        `/orgs/${orgId}/proxy/offers`,
        {},
        { Authorization: `Bearer ${jwtToken}` },
      );
      return extractRows(raw);
    },
  });
}
