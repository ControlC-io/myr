import { Navigate } from 'react-router-dom';
import { useSupplier } from '../context/SupplierContext';
import type { Role } from '../config/routePermissions';

interface RoleGuardProps {
  requiredRoles: Role[];
  children: React.ReactNode;
}

export function RoleGuard({ requiredRoles, children }: RoleGuardProps) {
  const { currentRoles, loading } = useSupplier();

  if (loading) return null;

  if (!requiredRoles.some((r) => currentRoles.includes(r))) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
