import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@shared/auth";
import { getJson, postJson, putJson } from "../api/client";

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

interface EditableSupplier {
  name: string;
  address: string;
  address_comment: string;
  num_tva: string;
  email: string;
  town: string;
  postcode: string;
  country: string;
  phonenumber: string;
}

interface NewContact {
  firstname: string;
  name: string;
  email: string;
  role: string;
}

const EMPTY_NEW_CONTACT: NewContact = {
  firstname: "",
  name: "",
  email: "",
  role: "",
};

export default function InformationClient() {
  const { t } = useTranslation("common");
  const { jwtToken, user, loading: authLoading, jwtLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [supplier, setSupplier] = useState<SupplierData | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<EditableSupplier | null>(null);
  const [localContacts, setLocalContacts] = useState<SupplierContact[]>([]);
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContact, setNewContact] = useState<NewContact>(EMPTY_NEW_CONTACT);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const requesterContactId = useMemo(() => {
    if (!user?.email || !supplier?.contacts) return null;
    const match = supplier.contacts.find(
      (c) => c.contact.email?.toLowerCase() === user.email?.toLowerCase()
    );
    return match ? match.contact.id : null;
  }, [user?.email, supplier?.contacts]);

  useEffect(() => {
    async function fetchData() {
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

        const { organizations } = await getJson<OrgsResponse>("/orgs/mine", undefined, {
          Authorization: `Bearer ${jwtToken}`,
        });

        if (organizations.length === 0) {
          setError("No organization found for the current user.");
          setLoading(false);
          return;
        }

        const orgId = organizations[0].id;

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
          setLocalContacts(supplierData.contacts);
        } else {
          setError("No supplier data found.");
        }
      } catch (err: unknown) {
        console.error("Failed to fetch information client:", err);

        const status =
          typeof err === "object" && err && "statusCode" in err
            ? (err as { statusCode?: number }).statusCode
            : undefined;

        if (status === 401) {
          setError("Your session is not authorized. Please sign in again.");
        } else if (status === 403) {
          setError("Organization access denied for this account.");
        } else if (status === 502) {
          setError("Unable to reach the external data service. Please contact your administrator.");
        } else {
          setError((err as Error).message || "An error occurred while fetching data.");
        }
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [jwtToken, authLoading, jwtLoading]);

  function handleEnterEdit() {
    if (!supplier) return;
    setEditData({
      name: supplier.name ?? "",
      address: supplier.address ?? "",
      address_comment: supplier.address_comment ?? "",
      num_tva: supplier.num_tva ?? "",
      email: supplier.email ?? "",
      town: supplier.town ?? "",
      postcode: supplier.postcode ?? "",
      country: supplier.country ?? "",
      phonenumber: supplier.phonenumber ?? "",
    });
    setIsEditing(true);
    setSaveSuccess(false);
    setShowAddContact(false);
    setNewContact(EMPTY_NEW_CONTACT);
  }

  function handleCancel() {
    setIsEditing(false);
    setEditData(null);
    setShowAddContact(false);
    setNewContact(EMPTY_NEW_CONTACT);
    setSaveError(null);
    if (supplier) setLocalContacts(supplier.contacts);
  }

  async function handleSave() {
    if (!supplier || !editData || !jwtToken) return;

    if (!requesterContactId) {
      setSaveError(t("pages.customerInfo.edit.saveErrorNoContact"));
      return;
    }

    setSaving(true);
    setSaveError(null);

    try {
      // 1. Compute supplier diff
      const supplierAttributes: Record<string, string> = {};
      (Object.keys(editData) as Array<keyof EditableSupplier>).forEach((key) => {
        const val = editData[key] || "";
        const origVal = (supplier[key as keyof SupplierData] as string) || "";
        if (val !== origVal) {
          supplierAttributes[key] = val;
        }
      });

      // 2. Compute contact updates (only for existing contacts that changed)
      const contactUpdates: Array<{ contactId: number; attributes: Record<string, string> }> = [];
      localContacts.forEach((local) => {
        // Skip new contacts for now as per plan scope
        if (local.contact.id.startsWith("new-")) return;

        const original = supplier.contacts.find((c) => c.contact.id === local.contact.id);
        if (!original) return;

        const attributes: Record<string, string> = {};
        if (local.contact.firstname !== original.contact.firstname) attributes.firstname = local.contact.firstname ?? "";
        if (local.contact.name !== original.contact.name) attributes.name = local.contact.name ?? "";
        if ((local.contact.email ?? "") !== (original.contact.email ?? "")) attributes.email = local.contact.email ?? "";

        if (Object.keys(attributes).length > 0) {
          contactUpdates.push({
            contactId: parseInt(local.contact.id, 10),
            attributes,
          });
        }
      });

      if (Object.keys(supplierAttributes).length === 0 && contactUpdates.length === 0) {
        setIsEditing(false);
        return;
      }

      const { organizations } = await getJson<OrgsResponse>("/orgs/mine", undefined, {
        Authorization: `Bearer ${jwtToken}`,
      });
      const orgId = organizations[0]?.id;

      await putJson(
        `/orgs/${orgId}/proxy/supplier/update`,
        {
          requesterContactId: parseInt(requesterContactId, 10),
          supplierAttributes,
          contactUpdates,
        },
        { Authorization: `Bearer ${jwtToken}` }
      );

      // Successfully saved
      setSupplier({
        ...supplier,
        ...editData,
        contacts: localContacts,
      });
      setIsEditing(false);
      setEditData(null);
      setShowAddContact(false);
      setNewContact(EMPTY_NEW_CONTACT);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error("Failed to save supplier information:", err);
      setSaveError(err.message || "An error occurred while saving changes.");
    } finally {
      setSaving(false);
    }
  }

  function handleFieldChange(field: keyof EditableSupplier, value: string) {
    setEditData((prev) => (prev ? { ...prev, [field]: value } : prev));
  }

  function handleAddContact() {
    if (!newContact.firstname.trim() && !newContact.name.trim()) return;
    const contact: SupplierContact = {
      contact: {
        id: `new-${Date.now()}`,
        firstname: newContact.firstname,
        name: newContact.name,
        email: newContact.email,
      },
      roles: newContact.role
        ? [{ contactroles: { name: newContact.role } }]
        : [],
    };
    setLocalContacts((prev) => [...prev, contact]);
    setNewContact(EMPTY_NEW_CONTACT);
    setShowAddContact(false);
  }

  function handleRemoveContact(id: string) {
    setLocalContacts((prev) => prev.filter((c) => c.contact.id !== id));
  }

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
        {t("pages.customerInfo.edit.noData")}
      </div>
    );
  }

  const InfoField = ({
    label,
    value,
    href,
  }: {
    label: string;
    value: string | undefined;
    href?: string;
  }) => (
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

  const EditField = ({
    label,
    field,
    type = "text",
  }: {
    label: string;
    field: keyof EditableSupplier;
    type?: string;
  }) => (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-medium text-textSecondary dark:text-textSecondary-dark uppercase tracking-wider">
        {label}
      </label>
      <input
        type={type}
        value={editData?.[field] ?? ""}
        onChange={(e) => handleFieldChange(field, e.target.value)}
        className="w-full px-3 py-1.5 text-sm rounded border border-border dark:border-border-dark bg-background dark:bg-background-dark text-textPrimary dark:text-textPrimary-dark focus:outline-none focus:ring-2 focus:ring-pink/40 focus:border-pink transition-colors"
      />
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
      <div
        className={`${sizeClasses} rounded-full bg-black-purple/30 dark:bg-white/10 flex items-center justify-center font-bold text-white shrink-0`}
      >
        {initials}
      </div>
    );
  };

  const SummaryRole = ({
    label,
    roleInitials,
    contactName,
  }: {
    label: string;
    roleInitials: string;
    contactName?: string;
  }) => (
    <div className="flex justify-between items-center py-2 border-b border-border/10 last:border-0">
      <span className="text-sm text-textPrimary dark:text-textPrimary-dark">{label}</span>
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

  const displaySupplier = isEditing && editData
    ? { ...supplier, ...editData }
    : supplier;

  const displayContacts = isEditing ? localContacts : supplier.contacts;

  return (
    <div className="flex-1 bg-background dark:bg-background-dark min-h-screen">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">

        {/* Page Title & Tabs */}
        <header className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-textPrimary dark:text-textPrimary-dark">
              {t("pages.customerInfo.title")}
            </h1>

            {saveSuccess && (
              <span className="flex items-center gap-2 text-sm font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded px-3 py-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {t("pages.customerInfo.edit.saveSuccess")}
              </span>
            )}
          </div>

          {/* Save / Cancel action bar */}
          {isEditing && (
            <div className={`flex items-center gap-3 px-4 py-3 border rounded-lg transition-colors ${
              saveError ? "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800" : "bg-pink/5 dark:bg-pink/10 border-pink/20"
            }`}>
              <svg className={`w-4 h-4 shrink-0 ${saveError ? "text-red-500" : "text-pink"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span className={`text-sm font-medium flex-1 ${saveError ? "text-red-700 dark:text-red-400" : "text-textPrimary dark:text-textPrimary-dark"}`}>
                {saveError ? `Error: ${saveError}` : t("pages.customerInfo.edit.banner")}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCancel}
                  disabled={saving}
                  className="px-4 py-1.5 text-sm font-semibold rounded border border-border dark:border-border-dark text-textSecondary dark:text-textSecondary-dark hover:bg-backgroundSecondary dark:hover:bg-backgroundSecondary-dark transition-colors disabled:opacity-50"
                >
                  {t("pages.customerInfo.edit.cancel")}
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-1.5 text-sm font-semibold rounded bg-pink text-white hover:bg-pink/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {saving && <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>}
                  {saving ? t("pages.customerInfo.edit.saving") : t("pages.customerInfo.edit.saveChanges")}
                </button>
              </div>
            </div>
          )}

          <div className="flex gap-8 border-b border-border/20">
            <button
              onClick={handleCancel}
              className={`pb-3 text-sm font-bold tracking-wide transition-colors ${
                !isEditing
                  ? "text-pink border-b-2 border-pink"
                  : "text-textSecondary dark:text-textSecondary-dark hover:text-textPrimary dark:hover:text-textPrimary-dark"
              }`}
            >
              {t("pages.customerInfo.tabs.info")}
            </button>
            <button
              onClick={handleEnterEdit}
              className={`pb-3 text-sm font-bold tracking-wide transition-colors ${
                isEditing
                  ? "text-pink border-b-2 border-pink"
                  : "text-textSecondary dark:text-textSecondary-dark hover:text-textPrimary dark:hover:text-textPrimary-dark"
              }`}
            >
              {t("pages.customerInfo.tabs.change")}
            </button>
          </div>
        </header>

        {/* Info Cards Grid */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Company Info */}
          <div className="bg-surface dark:bg-surface-dark border border-border dark:border-border-dark card--square-tl shadow-sm flex flex-col overflow-hidden">
            <div className="px-4 py-3 bg-secondary dark:bg-pink text-white border-b border-border/10 flex items-center gap-2">
              <span className="p-1 rounded bg-white/15 text-white">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </span>
              <h2 className="text-sm font-bold">{t("pages.customerInfo.sections.company")}</h2>
            </div>
            <div className="p-4 flex-1">
              {isEditing && editData ? (
                <div className="space-y-3">
                  <EditField label={t("pages.customerInfo.fields.companyName")} field="name" />
                  <InfoField label={t("pages.customerInfo.fields.customerNumber")} value={supplier.id} />
                  <EditField label={t("pages.customerInfo.fields.vatNumber")} field="num_tva" />
                  <EditField label={t("pages.customerInfo.fields.phone")} field="phonenumber" type="tel" />
                  <EditField label={t("pages.customerInfo.fields.email")} field="email" type="email" />
                </div>
              ) : (
                <div className="space-y-4">
                  <InfoField label={t("pages.customerInfo.fields.companyName")} value={displaySupplier.name} />
                  <InfoField label={t("pages.customerInfo.fields.customerNumber")} value={supplier.id} />
                  <InfoField label={t("pages.customerInfo.fields.vatNumber")} value={displaySupplier.num_tva} />
                  <InfoField label={t("pages.customerInfo.fields.phone")} value={displaySupplier.phonenumber} />
                  <InfoField
                    label={t("pages.customerInfo.fields.email")}
                    value={displaySupplier.email}
                    href={`mailto:${displaySupplier.email}`}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Address Info */}
          <div className="bg-surface dark:bg-surface-dark border border-border dark:border-border-dark card--square-tl shadow-sm flex flex-col overflow-hidden">
            <div className="px-4 py-3 bg-secondary dark:bg-pink text-white border-b border-border/10 flex items-center gap-2">
              <span className="p-1 rounded bg-white/15 text-white">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </span>
              <h2 className="text-sm font-bold">{t("pages.customerInfo.sections.address")}</h2>
            </div>
            <div className="p-4 flex-1">
              {isEditing && editData ? (
                <div className="space-y-3">
                  <EditField label={t("pages.customerInfo.fields.addressComment")} field="address_comment" />
                  <EditField label={t("pages.customerInfo.fields.address")} field="address" />
                  <EditField label={t("pages.customerInfo.fields.postalCode")} field="postcode" />
                  <EditField label={t("pages.customerInfo.fields.city")} field="town" />
                  <EditField label={t("pages.customerInfo.fields.country")} field="country" />
                </div>
              ) : (
                <div className="space-y-4">
                  <InfoField label={t("pages.customerInfo.fields.addressComment")} value={displaySupplier.address_comment} />
                  <InfoField label={t("pages.customerInfo.fields.address")} value={displaySupplier.address} />
                  <InfoField label={t("pages.customerInfo.fields.postalCode")} value={displaySupplier.postcode} />
                  <InfoField label={t("pages.customerInfo.fields.city")} value={displaySupplier.town} />
                  <InfoField label={t("pages.customerInfo.fields.country")} value={displaySupplier.country} />
                </div>
              )}
            </div>
          </div>

          {/* Contacts Summary */}
          <div className="bg-surface dark:bg-surface-dark border border-border dark:border-border-dark card--square-tl shadow-sm flex flex-col overflow-hidden">
            <div className="px-4 py-3 bg-secondary dark:bg-pink text-white border-b border-border/10 flex items-center gap-2">
              <span className="p-1 rounded bg-white/15 text-white">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 15.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </span>
              <h2 className="text-sm font-bold">{t("pages.customerInfo.sections.contactsSummary")}</h2>
            </div>
            <div className="p-4 flex-1">
              <SummaryRole
                label={t("pages.customerInfo.roles.technicalManager")}
                roleInitials="TM"
                contactName={displayContacts.find((c) => c.roles.some((r) => r.contactroles.name.toLowerCase().includes("technique")))?.contact.name}
              />
              <SummaryRole
                label={t("pages.customerInfo.roles.technicalBackup")}
                roleInitials="TB"
                contactName={displayContacts.find((c) => c.roles.some((r) => r.contactroles.name.toLowerCase().includes("backup")))?.contact.name}
              />
              <SummaryRole
                label={t("pages.customerInfo.roles.salesManager")}
                roleInitials="SM"
                contactName={displayContacts.find((c) => c.roles.some((r) => r.contactroles.name.toLowerCase().includes("commercial")))?.contact.name}
              />
              <SummaryRole
                label={t("pages.customerInfo.roles.internSalesManager")}
                roleInitials="IS"
                contactName={displayContacts.find((c) => c.roles.some((r) => r.contactroles.name.toLowerCase().includes("interne")))?.contact.name}
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
              {displayContacts.length}
            </span>

            {isEditing && !showAddContact && (
              <button
                onClick={() => setShowAddContact(true)}
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded border border-pink text-pink hover:bg-pink hover:text-white transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {t("pages.customerInfo.edit.addContact")}
              </button>
            )}
          </div>

          <div className="bg-surface dark:bg-surface-dark border border-border dark:border-border-dark card--square-tl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="table-header">
                  <tr>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest">{t("pages.customerInfo.edit.contactColumns.name")}</th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest">{t("pages.customerInfo.edit.contactColumns.phone")}</th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest">{t("pages.customerInfo.edit.contactColumns.phone2")}</th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest">{t("pages.customerInfo.edit.contactColumns.mobile")}</th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest">{t("pages.customerInfo.edit.contactColumns.email")}</th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest">{t("pages.customerInfo.edit.contactColumns.roles")}</th>
                    {isEditing && (
                      <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest w-12"></th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/5">
                  {/* Add new contact inline row */}
                  {isEditing && showAddContact && (
                    <tr className="bg-pink/5 dark:bg-pink/10">
                      <td className="px-6 py-3" colSpan={7}>
                        <div className="flex flex-col gap-3">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-semibold uppercase tracking-wider text-textSecondary dark:text-textSecondary-dark">
                                {t("pages.customerInfo.edit.newContact.firstname")}
                              </label>
                              <input
                                type="text"
                                placeholder={t("pages.customerInfo.edit.newContact.firstnamePlaceholder")}
                                value={newContact.firstname}
                                onChange={(e) => setNewContact((p) => ({ ...p, firstname: e.target.value }))}
                                className="px-3 py-1.5 text-sm rounded border border-border dark:border-border-dark bg-background dark:bg-background-dark text-textPrimary dark:text-textPrimary-dark focus:outline-none focus:ring-2 focus:ring-pink/40 focus:border-pink transition-colors"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-semibold uppercase tracking-wider text-textSecondary dark:text-textSecondary-dark">
                                {t("pages.customerInfo.edit.newContact.lastname")}
                              </label>
                              <input
                                type="text"
                                placeholder={t("pages.customerInfo.edit.newContact.lastnamePlaceholder")}
                                value={newContact.name}
                                onChange={(e) => setNewContact((p) => ({ ...p, name: e.target.value }))}
                                className="px-3 py-1.5 text-sm rounded border border-border dark:border-border-dark bg-background dark:bg-background-dark text-textPrimary dark:text-textPrimary-dark focus:outline-none focus:ring-2 focus:ring-pink/40 focus:border-pink transition-colors"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-semibold uppercase tracking-wider text-textSecondary dark:text-textSecondary-dark">
                                {t("pages.customerInfo.edit.newContact.email")}
                              </label>
                              <input
                                type="email"
                                placeholder={t("pages.customerInfo.edit.newContact.emailPlaceholder")}
                                value={newContact.email}
                                onChange={(e) => setNewContact((p) => ({ ...p, email: e.target.value }))}
                                className="px-3 py-1.5 text-sm rounded border border-border dark:border-border-dark bg-background dark:bg-background-dark text-textPrimary dark:text-textPrimary-dark focus:outline-none focus:ring-2 focus:ring-pink/40 focus:border-pink transition-colors"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-semibold uppercase tracking-wider text-textSecondary dark:text-textSecondary-dark">
                                {t("pages.customerInfo.edit.newContact.role")}
                              </label>
                              <input
                                type="text"
                                placeholder={t("pages.customerInfo.edit.newContact.rolePlaceholder")}
                                value={newContact.role}
                                onChange={(e) => setNewContact((p) => ({ ...p, role: e.target.value }))}
                                className="px-3 py-1.5 text-sm rounded border border-border dark:border-border-dark bg-background dark:bg-background-dark text-textPrimary dark:text-textPrimary-dark focus:outline-none focus:ring-2 focus:ring-pink/40 focus:border-pink transition-colors"
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={handleAddContact}
                              disabled={!newContact.firstname.trim() && !newContact.name.trim()}
                              className="px-4 py-1.5 text-xs font-semibold rounded bg-pink text-white hover:bg-pink/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                              {t("pages.customerInfo.edit.add")}
                            </button>
                            <button
                              onClick={() => {
                                setShowAddContact(false);
                                setNewContact(EMPTY_NEW_CONTACT);
                              }}
                              className="px-4 py-1.5 text-xs font-semibold rounded border border-border dark:border-border-dark text-textSecondary dark:text-textSecondary-dark hover:bg-backgroundSecondary dark:hover:bg-backgroundSecondary-dark transition-colors"
                            >
                              {t("pages.customerInfo.edit.cancel")}
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}

                  {displayContacts.map((contactWrapper, idx) => (
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
                      <td className="px-6 py-4 text-sm text-textSecondary dark:text-textSecondary-dark">—</td>
                      <td className="px-6 py-4 text-sm text-textSecondary dark:text-textSecondary-dark">—</td>
                      <td className="px-6 py-4 text-sm text-textSecondary dark:text-textSecondary-dark">—</td>
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
                      {isEditing && (
                        <td className="px-4 py-4">
                          <button
                            onClick={() => handleRemoveContact(contactWrapper.contact.id)}
                            title="Remove contact"
                            className="p-1.5 rounded text-textSecondary dark:text-textSecondary-dark hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </td>
                      )}
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
