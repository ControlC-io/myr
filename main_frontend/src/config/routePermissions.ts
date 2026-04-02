export const ROLES = {
  ADMIN: 'MYR-ADMIN',
  MANAGER: 'MYR-MANAGER',
  TICKET: 'MYR-TICKET',
  SECURITE: 'MYR-SECURITE',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROUTE_PERMISSIONS: Record<string, Role[]> = {
  '/tickets':                [ROLES.ADMIN, ROLES.MANAGER, ROLES.TICKET],
  '/intervention':          [ROLES.ADMIN, ROLES.MANAGER, ROLES.TICKET],
  '/invoice':            [ROLES.ADMIN, ROLES.MANAGER],
  '/payment-information':    [ROLES.ADMIN, ROLES.MANAGER],
  '/sepa':                   [ROLES.ADMIN, ROLES.MANAGER],
  '/customer-information':     [ROLES.ADMIN, ROLES.MANAGER],
  '/data-deletion':          [ROLES.ADMIN, ROLES.MANAGER],
  '/reservation-salles-bcp': [ROLES.ADMIN, ROLES.MANAGER],
  '/offer':                  [ROLES.ADMIN, ROLES.MANAGER],
  '/orders':              [ROLES.ADMIN, ROLES.MANAGER],
  '/services':               [ROLES.ADMIN, ROLES.MANAGER],
  '/kyc':                    [ROLES.ADMIN, ROLES.MANAGER],
  '/commande-rapide':        [ROLES.ADMIN, ROLES.MANAGER],
  '/securite':               [ROLES.SECURITE],
};
