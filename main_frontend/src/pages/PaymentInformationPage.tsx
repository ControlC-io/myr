import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@shared/auth";

type BankAccount = {
  id: string;
  label: string;
  countryCode: string;
  holderName: string;
  iban: string;
  bic: string;
};

const BANK_ACCOUNTS: BankAccount[] = [
  {
    id: "rcarre-lu",
    label: "Rcarré Luxembourg",
    countryCode: "LU",
    holderName: "Rcarré S.A.",
    iban: "LU12 0019 2455 3634 7000",
    bic: "BCEEULLL",
  },
  {
    id: "rcarre-fr",
    label: "Rcarré France",
    countryCode: "FR",
    holderName: "Rcarré France",
    iban: "FR76 1027 8051 7000 0206 0240 151",
    bic: "CMCIFR2A",
  },
  {
    id: "rcarre-be",
    label: "Rcarré Belgique",
    countryCode: "BE",
    holderName: "Rcarré Belgique sprl",
    iban: "BE49 0017 3818 8971",
    bic: "GEBABEBB",
  },
  {
    id: "rcube",
    label: "Rcube",
    countryCode: "LU",
    holderName: "Rcube Professional Services S.A.",
    iban: "LU07 0019 3755 9659 6000",
    bic: "BCEEULLL",
  },
  {
    id: "rsecure",
    label: "RSecure",
    countryCode: "LU",
    holderName: "RSecure",
    iban: "",
    bic: "",
  },
];

const countryFlag = (code: string) => {
  if (!code) return "";
  const upper = code.toUpperCase();
  if (upper.length !== 2) return "";
  const OFFSET = 127397;
  return String.fromCodePoint(
    upper.charCodeAt(0) + OFFSET,
    upper.charCodeAt(1) + OFFSET,
  );
};

const PaymentInformationPage = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation("common");

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [loading, user, navigate]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-background dark:bg-background-dark flex items-center justify-center">
        <p className="text-sec text-sm">{t("placeholders.loading")}</p>
      </div>
    );
  }

  return (
    <div className="bg-background dark:bg-background-dark py-10 min-h-[calc(100vh-3.5rem)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="card rounded-xl px-8 py-6 text-center border-b border-border dark:border-border-dark">
          <h1 className="text-2xl font-bold text-textPrimary dark:text-white">
            {t("pages.paymentInfo.title")}
          </h1>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {BANK_ACCOUNTS.map((account) => (
            <div
              key={account.id}
              className="card rounded-xl px-6 py-5 flex flex-col gap-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-textPrimary dark:text-white">
                    {account.label}
                  </p>
                </div>
                <div className="w-8 h-6 rounded border border-border dark:border-border-dark flex items-center justify-center text-xs bg-surface dark:bg-surface-dark">
                  <span aria-hidden="true">{countryFlag(account.countryCode)}</span>
                </div>
              </div>

              <div className="mt-1 space-y-1 text-xs text-textSecondary dark:text-textSecondary-dark">
                <div>
                  <p className="font-semibold text-[11px] uppercase tracking-wide text-textSecondary dark:text-textSecondary-dark">
                    Nom du titulaire
                  </p>
                  <p className="mt-0.5 text-sm text-textPrimary dark:text-textPrimary-dark">
                    {account.holderName || "—"}
                  </p>
                </div>

                <div className="pt-2 space-y-1">
                  <p className="font-semibold text-[11px] uppercase tracking-wide text-textSecondary dark:text-textSecondary-dark">
                    IBAN
                  </p>
                  <p className="mt-0.5 text-sm font-mono text-textPrimary dark:text-textPrimary-dark break-words">
                    {account.iban || "—"}
                  </p>
                </div>

                <div className="pt-2 space-y-1">
                  <p className="font-semibold text-[11px] uppercase tracking-wide text-textSecondary dark:text-textSecondary-dark">
                    BIC
                  </p>
                  <p className="mt-0.5 text-sm font-mono text-textPrimary dark:text-textPrimary-dark">
                    {account.bic || "—"}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PaymentInformationPage;

