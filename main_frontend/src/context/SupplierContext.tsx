import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from '@shared/auth';
import { getJson } from '../api/client';

export interface SupplierCompany {
  contact: { email: string; id: number };
  supplier: { id: number };
  roles: Array<{ contactroles: { name: string } }>;
}

interface SupplierContextValue {
  companies: SupplierCompany[];
  selectedSupplierId: string | null;
  setSelectedSupplierId: (id: string) => void;
  currentRoles: string[];
  loading: boolean;
  noAccess: boolean;
}

const SupplierContext = createContext<SupplierContextValue | undefined>(undefined);

const STORAGE_KEY = 'myr_selected_supplier';

interface SupplierApiResponse {
  data?: {
    contactSupplier?: {
      data?: SupplierCompany[];
    };
  };
}

export const SupplierProvider = ({ children }: { children: ReactNode }) => {
  const { jwtToken, loading: authLoading, jwtLoading, user } = useAuth();
  const [companies, setCompanies] = useState<SupplierCompany[]>([]);
  const [selectedSupplierId, setSelectedSupplierIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    if (authLoading || jwtLoading || !jwtToken || !user) return;

    setLoading(true);
    getJson<SupplierApiResponse>('/user/supplier-context', undefined, {
      Authorization: `Bearer ${jwtToken}`,
    })
      .then((result) => {
        const list = result?.data?.contactSupplier?.data ?? [];
        setCompanies(list);

        // Restore persisted selection or default to first company
        const stored = localStorage.getItem(STORAGE_KEY);
        const storedId = stored ? String(stored) : null;
        const validId = list.find((c) => String(c.supplier.id) === storedId)
          ? storedId
          : list.length > 0
            ? String(list[0].supplier.id)
            : null;
        setSelectedSupplierIdState(validId);
      })
      .catch(() => {
        setCompanies([]);
        setSelectedSupplierIdState(null);
      })
      .finally(() => {
        setLoading(false);
        setFetched(true);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jwtToken, authLoading, jwtLoading, user]);

  // Clear state on logout
  useEffect(() => {
    if (!user && fetched) {
      setCompanies([]);
      setSelectedSupplierIdState(null);
      setFetched(false);
    }
  }, [user, fetched]);

  const setSelectedSupplierId = (id: string) => {
    setSelectedSupplierIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
  };

  const currentRoles: string[] = companies
    .find((c) => String(c.supplier.id) === selectedSupplierId)
    ?.roles.map((r) => r.contactroles.name) ?? [];

  const noAccess = fetched && !loading && companies.length === 0;

  return (
    <SupplierContext.Provider
      value={{ companies, selectedSupplierId, setSelectedSupplierId, currentRoles, loading, noAccess }}
    >
      {children}
    </SupplierContext.Provider>
  );
};

export const useSupplier = (): SupplierContextValue => {
  const context = useContext(SupplierContext);
  if (!context) throw new Error('useSupplier must be used within a SupplierProvider');
  return context;
};
