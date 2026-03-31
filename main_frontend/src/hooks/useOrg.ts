import { useSupplier } from '../context/SupplierContext';

export function useOrg(): string | null {
  const { selectedSupplierId } = useSupplier();
  return selectedSupplierId;
}
