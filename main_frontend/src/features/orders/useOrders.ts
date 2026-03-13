import { useQuery } from "@tanstack/react-query";
import { postJson } from "../../api/client";
import { useAuth } from "@shared/auth";

export type OrderItem = {
  id: number | string;
  reference: string | null;
  date: string | null;
  delivery_date: string | null;
  description: string | null;
  status: string | null;
  amount: string | null;
};

export const orderQueryKeys = {
  all: ["orders"] as const,
  client: (orgId: string | number) => ["orders", "client", orgId] as const,
};

function extractRows(raw: unknown): OrderItem[] {
  if (Array.isArray(raw)) return raw as OrderItem[];
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    console.log("[useOrders] raw response wrapper keys:", Object.keys(obj));
    for (const key of ["data", "commands", "orders", "items", "list", "documents"]) {
      if (Array.isArray(obj[key])) {
        const rows = obj[key] as OrderItem[];
        if (rows.length > 0) {
          console.log("[useOrders] first row fields:", Object.keys(rows[0] as object));
          console.log("[useOrders] first row data:", rows[0]);
        }
        return rows;
      }
    }
    console.log("[useOrders] no array found under known keys, full response:", raw);
  }
  return [];
}

export function useOrders(orgId: string | null) {
  const { jwtToken, jwtLoading } = useAuth();

  return useQuery<OrderItem[]>({
    queryKey: orderQueryKeys.client(orgId ?? ""),
    enabled: !!jwtToken && !jwtLoading && !!orgId,
    queryFn: async () => {
      if (!jwtToken) {
        return Promise.reject(new Error("No JWT token available."));
      }
      const raw = await postJson<Record<string, never>, unknown>(
        `/orgs/${orgId}/proxy/orders`,
        {},
        { Authorization: `Bearer ${jwtToken}` },
      );
      return extractRows(raw);
    },
  });
}
