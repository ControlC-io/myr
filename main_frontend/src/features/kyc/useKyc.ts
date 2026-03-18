import { useQuery } from "@tanstack/react-query";
import { postJson } from "../../api/client";
import { useAuth } from "@shared/auth";

export interface KycDocument {
  id: number | string;
  name: string | null;
  type: string | null;
  status: string | null;
  date: string | null;
  expiry_date: string | null;
  [key: string]: unknown;
}

export const kycQueryKeys = {
  all: ["kyc"] as const,
  client: (orgId: string) => ["kyc", "client", orgId] as const,
};

function extractRows(raw: unknown): KycDocument[] {
  if (Array.isArray(raw)) return raw as KycDocument[];
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const data = obj["data"];
    if (Array.isArray(data)) return data as KycDocument[];
    if (data && typeof data === "object" && !Array.isArray(data)) {
      return Object.values(data as Record<string, unknown>) as KycDocument[];
    }
    for (const key of ["documents", "items", "list", "kyc"]) {
      if (Array.isArray(obj[key])) return obj[key] as KycDocument[];
    }
  }
  return [];
}

export function useKyc(orgId: string | null) {
  const { jwtToken, jwtLoading } = useAuth();

  return useQuery<KycDocument[]>({
    queryKey: kycQueryKeys.client(orgId ?? ""),
    enabled: !!jwtToken && !jwtLoading && !!orgId,
    queryFn: async () => {
      if (!jwtToken) {
        return Promise.reject(new Error("No JWT token available."));
      }
      const raw = await postJson<Record<string, never>, unknown>(
        `/orgs/${orgId}/proxy/kyc`,
        {},
        { Authorization: `Bearer ${jwtToken}` },
      );
      return extractRows(raw);
    },
  });
}
