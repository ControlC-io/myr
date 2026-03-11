import type { FC } from "react";
import { useEffect, useState } from "react";
import i18n from "../i18n";
import frFlag from "../assets/flags/Flag_of_France_(1794–1815,_1830–1974).svg";
import ukFlag from "../assets/flags/Flag_of_the_United_Kingdom_(3-5).svg";

export type Language = "fr" | "en";

interface LanguagePickerProps {
  className?: string;
  onChange?: (language: Language) => void;
}

const STORAGE_KEY = "my-rcarre-language";

const getInitialLanguage = (): Language => {
  if (typeof window === "undefined") {
    return "fr";
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);

  if (stored === "en" || stored === "fr") {
    return stored;
  }

  const current = i18n.language;
  return current === "en" ? "en" : "fr";
};

const LanguagePicker: FC<LanguagePickerProps> = ({ className = "", onChange }) => {
  const [language, setLanguage] = useState<Language>(getInitialLanguage);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    void i18n.changeLanguage(language);
    window.localStorage.setItem(STORAGE_KEY, language);

    if (onChange) {
      onChange(language);
    }
  }, [language, onChange]);

  const handleSelect = (value: Language) => {
    setLanguage(value);
  };

  return (
    <div
      className={`inline-flex items-center gap-1 ${className}`}
      aria-label="Language selection"
    >
      {(["fr", "en"] as Language[]).map((lang) => {
        const isActive = language === lang;
        return (
          <button
            key={lang}
            type="button"
            onClick={() => handleSelect(lang)}
            className={`relative flex items-center justify-center h-7 w-10 rounded-full transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-1 ${
              isActive
                ? "bg-secondary shadow-sm opacity-100"
                : "bg-transparent opacity-30 hover:opacity-60"
            }`}
            aria-pressed={isActive}
            title={lang === "fr" ? "Français" : "English"}
          >
            <img
              src={lang === "fr" ? frFlag : ukFlag}
              alt={lang === "fr" ? "French" : "English"}
              className="h-4 w-auto rounded-sm"
            />
          </button>
        );
      })}
    </div>
  );
};

export default LanguagePicker;
