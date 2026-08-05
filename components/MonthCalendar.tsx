'use client';

import { monthGrid } from '@/lib/date';

interface MonthCalendarProps {
  year: number;
  month: number; // 1~12
  contentDates: Set<string>; // 콘텐츠 있는 날짜
  doneDates: Set<string>; // 완료한 날짜
  today: string;
  onSelect?: (date: string) => void;
  compact?: boolean; // 홈 미니 달력용 (작은 셀, 범례 없음)
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

type CellState = 'none' | 'done' | 'missed' | 'today' | 'future';

function cellState(date: string, today: string, hasContent: boolean, isDone: boolean): CellState {
  if (isDone) return 'done';
  if (date === today) return 'today';
  if (date > today) return 'future';
  if (hasContent) return 'missed';
  return 'none';
}

const CELL_STYLE: Record<CellState, string> = {
  none: 'bg-gray-100 text-gray-300 dark:bg-gray-800 dark:text-gray-600',
  done: 'bg-green-500 text-white dark:bg-green-600',
  missed:
    'bg-white border-2 border-orange-400 text-orange-600 dark:bg-transparent dark:border-orange-500 dark:text-orange-400',
  today:
    'bg-blue-50 border-2 border-blue-500 text-blue-700 font-semibold dark:bg-blue-950 dark:border-blue-400 dark:text-blue-300',
  future: 'bg-gray-50 text-gray-300 dark:bg-gray-900 dark:text-gray-700',
};

const LEGEND: { state: CellState; label: string }[] = [
  { state: 'none', label: '콘텐츠 없음' },
  { state: 'done', label: '완료' },
  { state: 'missed', label: '놓친 날' },
  { state: 'today', label: '오늘' },
  { state: 'future', label: '예정' },
];

export default function MonthCalendar({
  year,
  month,
  contentDates,
  doneDates,
  today,
  onSelect,
  compact = false,
}: MonthCalendarProps) {
  const weeks = monthGrid(year, month);
  const cellSize = compact ? 'min-h-8 text-xs' : 'min-h-10 sm:min-h-12 text-sm';

  return (
    <div className={compact ? 'rounded-2xl border border-gray-200 p-3 dark:border-gray-800' : 'rounded-2xl border border-gray-200 p-4 dark:border-gray-800'}>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-center text-xs font-medium text-gray-400 dark:text-gray-500">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {weeks.flatMap((week, wi) =>
          week.map((date, di) => {
            const key = `${wi}-${di}`;
            if (!date) return <div key={key} className={cellSize} />;

            const hasContent = contentDates.has(date);
            const isDone = doneDates.has(date);
            const state = cellState(date, today, hasContent, isDone);
            const clickable = hasContent && date <= today;
            const day = Number(date.slice(-2));

            return (
              <button
                key={key}
                type="button"
                disabled={!clickable}
                onClick={() => clickable && onSelect?.(date)}
                className={`${cellSize} w-full rounded-lg flex items-center justify-center transition-colors ${CELL_STYLE[state]} ${
                  clickable ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed'
                }`}
              >
                {day}
              </button>
            );
          }),
        )}
      </div>
      {!compact && (
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
          {LEGEND.map(({ state, label }) => (
            <div key={state} className="flex items-center gap-1.5">
              <span className={`inline-block h-3 w-3 rounded ${CELL_STYLE[state]}`} />
              <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
