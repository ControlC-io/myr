import { useState } from "react";
import { useTranslation } from "react-i18next";

export interface CalendarEvent {
  id: number | string;
  date: string; // YYYY-MM-DD
  label: string;
  time?: string; // HH:MM
  colorClass?: string;
  onClick?: () => void;
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

const MONTH_NAMES_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTH_NAMES_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

const DAY_HEADERS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

interface MonthCalendarProps {
  events?: CalendarEvent[];
}

const MonthCalendar = ({ events = [] }: MonthCalendarProps) => {
  const { i18n } = useTranslation("common");
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const monthNames = i18n.language.startsWith("fr") ? MONTH_NAMES_FR : MONTH_NAMES_EN;
  const monthLabel = `${monthNames[cursor.getMonth()]} ${cursor.getFullYear()}`;

  const prevMonth = () => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1));
  const nextMonth = () => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1));

  const firstOfMonth = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const startDate = getMondayOfWeek(firstOfMonth);

  const weeks: Date[][] = [];
  const current = new Date(startDate);
  for (let row = 0; row < 6; row++) {
    const week: Date[] = [];
    for (let col = 0; col < 7; col++) {
      week.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    weeks.push(week);
  }

  return (
    <div className="bg-surface dark:bg-surface-dark border border-border dark:border-border-dark card--square-tl shadow-sm overflow-hidden">
      {/* Month navigation */}
      <div className="flex items-center justify-center gap-6 py-4 border-b border-border dark:border-border-dark">
        <button
          type="button"
          onClick={prevMonth}
          className="p-1 rounded hover:bg-primary/20 dark:hover:bg-primary/10 text-textSecondary dark:text-textSecondary-dark transition-colors"
          aria-label="Previous month"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-base font-semibold text-textPrimary dark:text-textPrimary-dark w-40 text-center">
          {monthLabel}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          className="p-1 rounded hover:bg-primary/20 dark:hover:bg-primary/10 text-textSecondary dark:text-textSecondary-dark transition-colors"
          aria-label="Next month"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Calendar grid */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse table-fixed">
          <thead>
            <tr className="bg-backgroundSecondary dark:bg-backgroundSecondary-dark border-b border-border dark:border-border-dark">
              <th className="w-14 py-3 text-[10px] font-bold uppercase tracking-widest text-textSecondary dark:text-textSecondary-dark text-center">
                WEEK
              </th>
              {DAY_HEADERS.map((day) => (
                <th
                  key={day}
                  className="py-3 text-[10px] font-bold uppercase tracking-widest text-textSecondary dark:text-textSecondary-dark text-left pl-3"
                >
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week, rowIdx) => {
              const weekNum = getWeekNumber(week[0]);
              return (
                <tr
                  key={rowIdx}
                  className="border-b border-border/30 dark:border-border-dark/30 last:border-b-0"
                >
                  <td className="w-14 border-r border-border/30 dark:border-border-dark/30 text-center align-top py-3">
                    <span className="text-xs font-medium text-textSecondary dark:text-textSecondary-dark">
                      {weekNum}
                    </span>
                  </td>
                  {week.map((day, colIdx) => {
                    const isCurrentMonth = day.getMonth() === cursor.getMonth();
                    const isToday = isSameDay(day, today);
                    const dayKey = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
                    const dayEvents = events.filter((e) => e.date === dayKey);
                    const visibleEvents = dayEvents.slice(0, 3);
                    const hiddenCount = dayEvents.length - visibleEvents.length;

                    return (
                      <td
                        key={colIdx}
                        className="border-r border-border/30 dark:border-border-dark/30 last:border-r-0 align-top pl-3 pt-3 pb-3 min-h-[120px]"
                      >
                        <span
                          className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-medium transition-colors ${
                            isToday
                              ? "bg-secondary text-white font-bold"
                              : isCurrentMonth
                              ? "text-textPrimary dark:text-textPrimary-dark"
                              : "text-textSecondary/40 dark:text-textSecondary-dark/40"
                          }`}
                        >
                          {day.getDate()}
                        </span>
                        {visibleEvents.length > 0 && (
                          <div className="mt-1 space-y-0.5 pr-1">
                            {visibleEvents.map((ev) => (
                              <div
                                key={ev.id}
                                title={ev.label}
                                onClick={ev.onClick}
                                className={`text-[10px] px-1.5 py-1 rounded ${ev.colorClass ?? "bg-secondary/15 text-secondary dark:bg-secondary/80 dark:text-white"} ${ev.onClick ? "cursor-pointer hover:opacity-80 transition-opacity" : ""}`}
                              >
                                {ev.time && (
                                  <span className="block font-bold leading-tight">
                                    {ev.time}
                                  </span>
                                )}
                                <span className="block truncate font-medium leading-tight mt-0.5">
                                  {ev.label}
                                </span>
                              </div>
                            ))}
                            {hiddenCount > 0 && (
                              <div className="text-[10px] text-textSecondary dark:text-textSecondary-dark pl-0.5">
                                +{hiddenCount}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MonthCalendar;
