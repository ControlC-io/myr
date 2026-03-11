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
  address_comment?: string;
  num_tva: string;
  email: string;
  town: string;
  postcode?: string;
  country?: string;
  phonenumber?: string;
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
        } else if (status === 502) {
          setError("Unable to reach the external data service. Please contact your administrator.");
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

  // Local helper components for the new layout
  const InfoField = ({ label, value, href }: { label: string; value: string | undefined; href?: string }) => (
    <div className="flex justify-between items-start group">
      <span className="text-[11px] font-medium text-textSecondary dark:text-textSecondary-dark uppercase tracking-wider mt-0.5">
        {label}
      </span>
      <div className="text-right">
        {href ? (
          <a href={href} className="text-sm font-medium text-pink dark:text-pink-700 hover:underline">
            {value || "—"}
          </a>
        ) : (
          <span className="text-sm font-medium text-textPrimary dark:text-textPrimary-dark">
            {value || "—"}
          </span>
        )}
      </div>
    </div>
  );

  const ContactAvatar = ({ name, size = "md" }: { name: string; size?: "sm" | "md" }) => {
    const initials = name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
    
    const sizeClasses = size === "sm" ? "h-6 w-6 text-[10px]" : "h-8 w-8 text-xs";
    
    return (
      <div className={`${sizeClasses} rounded-full bg-black-purple/30 dark:bg-white/10 flex items-center justify-center font-bold text-white shrink-0`}>
        {initials}
      </div>
    );
  };

  const SummaryRole = ({ label, roleInitials, contactName }: { label: string; roleInitials: string; contactName?: string }) => (
    <div className="flex justify-between items-center py-2 border-b border-border/10 last:border-0">
      <span className="text-sm text-textPrimary dark:text-textPrimary-dark">
        {label}
      </span>
      <div className="flex items-center gap-2">
        {contactName ? (
          <>
            <ContactAvatar name={contactName} size="sm" />
            <span className="text-xs italic text-textSecondary dark:text-textSecondary-dark">
              {contactName}
            </span>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-black-purple/20 dark:bg-white/10 flex items-center justify-center text-[10px] font-bold text-textSecondary dark:text-textSecondary-dark italic">
              {roleInitials}
            </div>
            <span className="text-xs italic text-textSecondary dark:text-textSecondary-dark">
              {t("pages.customerInfo.roles.notAssigned")}
            </span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex-1 bg-background dark:bg-background-dark min-h-screen">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Page Title & Tabs */}
        <header className="space-y-6">
          <h1 className="text-2xl font-bold text-textPrimary dark:text-textPrimary-dark">
            {t("pages.customerInfo.title")}
          </h1>
          
          <div className="flex gap-8 border-b border-border/20">
            <button className="pb-3 text-sm font-bold text-pink border-b-2 border-pink tracking-wide">
              {t("pages.customerInfo.tabs.info")}
            </button>
            <button className="pb-3 text-sm font-bold text-textSecondary dark:text-textSecondary-dark hover:text-textPrimary dark:hover:text-textPrimary-dark transition-colors tracking-wide">
              {t("pages.customerInfo.tabs.change")}
            </button>
          </div>
        </header>

        {/* Info Cards Grid */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Company Info */}
          <div className="bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-xl shadow-sm flex flex-col overflow-hidden">
            <div className="px-4 py-3 bg-pink/10 dark:bg-pink/5 border-b border-border/10 flex items-center gap-2">
              <span className="p-1 rounded bg-pink/20 text-pink">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </span>
              <h2 className="text-sm font-bold text-textPrimary dark:text-textPrimary-dark">
                {t("pages.customerInfo.sections.company")}
              </h2>
            </div>
            <div className="p-4 space-y-4 flex-1">
              <InfoField label={t("pages.customerInfo.fields.companyName")} value={supplier.name} />
              <InfoField label={t("pages.customerInfo.fields.customerNumber")} value={supplier.id} />
              <InfoField label={t("pages.customerInfo.fields.vatNumber")} value={supplier.num_tva} />
              <InfoField label={t("pages.customerInfo.fields.phone")} value={supplier.phonenumber} />
              <InfoField label={t("pages.customerInfo.fields.email")} value={supplier.email} href={`mailto:${supplier.email}`} />
            </div>
          </div>

          {/* Address Info */}
          <div className="bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-xl shadow-sm flex flex-col overflow-hidden">
            <div className="px-4 py-3 bg-pink/10 dark:bg-pink/5 border-b border-border/10 flex items-center gap-2">
              <span className="p-1 rounded bg-pink/20 text-pink">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </span>
              <h2 className="text-sm font-bold text-textPrimary dark:text-textPrimary-dark">
                {t("pages.customerInfo.sections.address")}
              </h2>
            </div>
            <div className="p-4 space-y-4 flex-1">
              <InfoField label={t("pages.customerInfo.fields.addressComment")} value={supplier.address_comment} />
              <InfoField label={t("pages.customerInfo.fields.address")} value={supplier.address} />
              <InfoField label={t("pages.customerInfo.fields.postalCode")} value={supplier.postcode} />
              <InfoField label={t("pages.customerInfo.fields.city")} value={supplier.town} />
              <InfoField label={t("pages.customerInfo.fields.country")} value={supplier.country} />
            </div>
          </div>

          {/* Contacts Summary */}
          <div className="bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-xl shadow-sm flex flex-col overflow-hidden">
            <div className="px-4 py-3 bg-pink/10 dark:bg-pink/5 border-b border-border/10 flex items-center gap-2">
              <span className="p-1 rounded bg-pink/20 text-pink">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 15.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </span>
              <h2 className="text-sm font-bold text-textPrimary dark:text-textPrimary-dark">
                {t("pages.customerInfo.sections.contactsSummary")}
              </h2>
            </div>
            <div className="p-4 flex-1">
              <SummaryRole 
                label={t("pages.customerInfo.roles.technicalManager")} 
                roleInitials="TM"
                contactName={supplier.contacts.find(c => c.roles.some(r => r.contactroles.name.toLowerCase().includes("technique")))?.contact.name}
              />
              <SummaryRole 
                label={t("pages.customerInfo.roles.technicalBackup")} 
                roleInitials="TB"
                contactName={supplier.contacts.find(c => c.roles.some(r => r.contactroles.name.toLowerCase().includes("backup")))?.contact.name}
              />
              <SummaryRole 
                label={t("pages.customerInfo.roles.salesManager")} 
                roleInitials="SM"
                contactName={supplier.contacts.find(c => c.roles.some(r => r.contactroles.name.toLowerCase().includes("commercial")))?.contact.name}
              />
              <SummaryRole 
                label={t("pages.customerInfo.roles.internSalesManager")} 
                roleInitials="IS"
                contactName={supplier.contacts.find(c => c.roles.some(r => r.contactroles.name.toLowerCase().includes("interne")))?.contact.name}
              />
            </div>
          </div>
        </section>

        {/* Contact Persons Table */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="p-1 rounded bg-pink/20 text-pink">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </span>
            <h2 className="text-lg font-bold text-textPrimary dark:text-textPrimary-dark">
              {t("pages.customerInfo.sections.contactPersons")}
            </h2>
            <span className="h-5 w-5 rounded-full bg-pink text-white text-[10px] font-bold flex items-center justify-center">
              {supplier.contacts.length}
            </span>
          </div>

          <div className="bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-xl shadow-sm overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-pink via-secondary to-pink/50"></div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-black-purple/5 dark:bg-white/5 border-b border-border/10">
                    <th className="px-6 py-4 text-[11px] font-bold text-textSecondary dark:text-textSecondary-dark uppercase tracking-widest">
                      Name
                    </th>
                    <th className="px-6 py-4 text-[11px] font-bold text-textSecondary dark:text-textSecondary-dark uppercase tracking-widest">
                      Phone
                    </th>
                    <th className="px-6 py-4 text-[11px] font-bold text-textSecondary dark:text-textSecondary-dark uppercase tracking-widest">
                      Phone 2
                    </th>
                    <th className="px-6 py-4 text-[11px] font-bold text-textSecondary dark:text-textSecondary-dark uppercase tracking-widest">
                      Mobile
                    </th>
                    <th className="px-6 py-4 text-[11px] font-bold text-textSecondary dark:text-textSecondary-dark uppercase tracking-widest">
                      Email
                    </th>
                    <th className="px-6 py-4 text-[11px] font-bold text-textSecondary dark:text-textSecondary-dark uppercase tracking-widest">
                      Roles
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/5">
                  {supplier.contacts.map((contactWrapper, idx) => (
                    <tr
                      key={contactWrapper.contact.id || idx}
                      className="hover:bg-backgroundSecondary/50 dark:hover:bg-backgroundSecondary-dark/50 transition-colors group"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <ContactAvatar name={`${contactWrapper.contact.firstname} ${contactWrapper.contact.name}`} />
                          <span className="text-sm font-bold text-textPrimary dark:text-textPrimary-dark group-hover:text-pink transition-colors">
                            {contactWrapper.contact.firstname} {contactWrapper.contact.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-textSecondary dark:text-textSecondary-dark">
                        —
                      </td>
                      <td className="px-6 py-4 text-sm text-textSecondary dark:text-textSecondary-dark">
                        —
                      </td>
                      <td className="px-6 py-4 text-sm text-textSecondary dark:text-textSecondary-dark">
                        —
                      </td>
                      <td className="px-6 py-4">
                        <a 
                          href={`mailto:${contactWrapper.contact.email}`}
                          className="text-sm text-pink/80 dark:text-pink/60 hover:text-pink hover:underline"
                        >
                          {contactWrapper.contact.email}
                        </a>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          {contactWrapper.roles.map((role, roleIdx) => {
                            const roleName = role.contactroles.name;
                            const isSpecial = roleName.includes("ADMIN") || roleName.includes("SECURITE");
                            return (
                              <span
                                key={roleIdx}
                                className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-tight ${
                                  isSpecial 
                                    ? "bg-secondary/10 text-secondary border border-secondary/20" 
                                    : "bg-primary/20 text-textPrimary border border-primary/30"
                                }`}
                              >
                                {roleName}
                              </span>
                            );
                          })}
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
    </div>
  );
}
