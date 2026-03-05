import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@shared/auth";
import { getJson, postJson } from "../api/client";

interface SupplierContact {
  contact: {
    id: string;
    firstname: string;
    name: string;
    email: string;
  };
  roles: Array<{
    contactroles: {
      name: string;
    };
  }>;
}

interface SupplierData {
  id: string;
  name: string;
  address: string;
  num_tva: string;
  email: string;
  town: string;
  contacts: SupplierContact[];
}

interface ProxyResponse {
  data: {
    supplier: {
      data: SupplierData[];
    };
  };
}

interface Org {
  id: string;
  name: string;
  role: string;
}

interface OrgsResponse {
  organizations: Org[];
}

export default function InformationClient() {
  const { t } = useTranslation("common");
  const { jwtToken, loading: authLoading, jwtLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [supplier, setSupplier] = useState<SupplierData | null>(null);

  useEffect(() => {
    async function fetchData() {
      // Mientras la sesión o el JWT sigan cargando, mantenemos el estado de carga.
      if (authLoading || jwtLoading) {
        setLoading(true);
        return;
      }

      if (!jwtToken) {
        setError("No JWT token available. Please log out and log in again.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // 1. Get the organization ID
        const { organizations } = await getJson<OrgsResponse>("/orgs/mine", undefined, {
          Authorization: `Bearer ${jwtToken}`,
        });

        if (organizations.length === 0) {
          setError("No organization found for the current user.");
          setLoading(false);
          return;
        }

        const orgId = organizations[0].id;

        // 2. Fetch data from the proxy - empty body because backend constructs the query based on the organization
        const response = await postJson<{}, ProxyResponse>(
          `/orgs/${orgId}/proxy/supplier`,
          {},
          {
            Authorization: `Bearer ${jwtToken}`,
          }
        );

        const supplierData = response.data?.supplier?.data?.[0];
        if (supplierData) {
          setSupplier(supplierData);
        } else {
          setError("No supplier data found.");
        }
      } catch (err: any) {
        console.error("Failed to fetch information client:", err);

        const status = typeof err === "object" && err && "statusCode" in err ? (err as { statusCode?: number }).statusCode : undefined;

        if (status === 401) {
          setError("Your session is not authorized. Please sign in again.");
        } else if (status === 403) {
          setError("Organization access denied for this account.");
        } else {
          setError(err.message || "An error occurred while fetching data.");
        }
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [jwtToken, authLoading, jwtLoading]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary dark:border-primary-dark"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 p-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-400">
          {error}
        </div>
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="flex-1 p-8 text-center text-textSecondary dark:text-textSecondary-dark">
        No data available.
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 sm:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto w-full">
      <header>
        <h1 className="text-2xl font-bold text-textPrimary dark:text-textPrimary-dark">
          {t("pages.customerInfo.title")}
        </h1>
      </header>

      {/* Company Info Card */}
      <section className="bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-xl shadow-sm overflow-hidden">
        <div className="p-6">
          <h2 className="text-xl font-bold text-textPrimary dark:text-textPrimary-dark mb-4">
            {supplier.name}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-textSecondary dark:text-textSecondary-dark uppercase tracking-wider">
                  Address
                </label>
                <p className="mt-1 text-textPrimary dark:text-textPrimary-dark">
                  {supplier.address}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-textSecondary dark:text-textSecondary-dark uppercase tracking-wider">
                  Town
                </label>
                <p className="mt-1 text-textPrimary dark:text-textPrimary-dark">
                  {supplier.town}
                </p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-textSecondary dark:text-textSecondary-dark uppercase tracking-wider">
                  VAT (num_tva)
                </label>
                <p className="mt-1 text-textPrimary dark:text-textPrimary-dark">
                  {supplier.num_tva}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-textSecondary dark:text-textSecondary-dark uppercase tracking-wider">
                  Email
                </label>
                <p className="mt-1 text-textPrimary dark:text-textPrimary-dark">
                  {supplier.email}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contacts Table */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-textPrimary dark:text-textPrimary-dark">
          Contacts
        </h3>
        <div className="bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-backgroundSecondary dark:bg-backgroundSecondary-dark border-b border-border dark:border-border-dark">
                  <th className="px-6 py-4 text-xs font-semibold text-textSecondary dark:text-textSecondary-dark uppercase tracking-wider">
                    Full Name
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-textSecondary dark:text-textSecondary-dark uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-textSecondary dark:text-textSecondary-dark uppercase tracking-wider">
                    Roles
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border dark:divide-border-dark">
                {supplier.contacts.map((contactWrapper, idx) => (
                  <tr
                    key={contactWrapper.contact.id || idx}
                    className="hover:bg-backgroundSecondary/50 dark:hover:bg-backgroundSecondary-dark/50 transition-colors"
                  >
                    <td className="px-6 py-4 text-sm text-textPrimary dark:text-textPrimary-dark">
                      {contactWrapper.contact.firstname} {contactWrapper.contact.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-textSecondary dark:text-textSecondary-dark">
                      {contactWrapper.contact.email}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex flex-wrap gap-2">
                        {contactWrapper.roles.map((role, roleIdx) => (
                          <span
                            key={roleIdx}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary dark:bg-primary-dark/20 dark:text-primary-dark border border-primary/20 dark:border-primary-dark/30"
                          >
                            {role.contactroles.name}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
