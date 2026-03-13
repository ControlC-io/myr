import type { FC } from "react";
import { useTheme } from "../theme/ThemeProvider";

interface ThemeToggleProps {
  className?: string;
}

const ThemeToggle: FC<ThemeToggleProps> = ({ className = "" }) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      role="switch"
      aria-checked={isDark}
      className={`group relative inline-flex h-6 w-12 items-center rounded-full bg-surface dark:bg-surface-dark border border-border dark:border-border-dark shadow-inner transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${className}`}
      aria-label="Toggle dark mode"
    >
      <span className="sr-only">Turn dark mode on or off</span>
      <span
        className={`inline-flex h-4 w-4 transform items-center justify-center rounded-full bg-background dark:bg-background-dark shadow-md ring-1 ring-border dark:ring-border-dark transition-transform duration-200 ${
          isDark ? "translate-x-7" : "translate-x-1"
        }`}
        aria-hidden="true"
      >
        {isDark ? (
          <svg
            className="h-2.5 w-2.5 text-textSecondary dark:text-textSecondary-dark"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M21 12.79A9 9 0 0 1 11.21 3 7 7 0 1 0 21 12.79Z" />
          </svg>
        ) : (
          <svg
            className="h-2.5 w-2.5 text-secondary-on-light dark:text-secondary-on-dark"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 4.5a1 1 0 0 1-1-1V2.25a1 1 0 1 1 2 0V3.5a1 1 0 0 1-1 1Zm0 17.25a1 1 0 0 1-1 1v0a1 1 0 0 1-1-1V20.5a1 1 0 0 1 2 0Zm9-8.75a1 1 0 0 1-1 1h-1.25a1 1 0 0 1 0-2H20a1 1 0 0 1 1 1Zm-15.75 1a1 1 0 0 1 0-2H6.5a1 1 0 0 1 0 2Zm11.248-6.532a1 1 0 0 1 1.414-1.414l.884.884a1 1 0 0 1-1.414 1.414Zm-9.9 9.9a1 1 0 0 1 1.414-1.414l.884.884a1 1 0 0 1-1.414 1.414Zm0-9.9.884-.884a1 1 0 1 1 1.414 1.414l-.884.884A1 1 0 0 1 6.6 7.468Zm9.9 9.9.884-.884a1 1 0 1 1 1.414 1.414l-.884.884a1 1 0 0 1-1.414-1.414ZM12 7.25A4.75 4.75 0 1 0 16.75 12 4.756 4.756 0 0 0 12 7.25Z" />
          </svg>
        )}
      </span>
    </button>
  );
};

export default ThemeToggle;

