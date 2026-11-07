import { DIFFICULTIES, type Difficulty } from "../types/resource";

interface Props {
  value: Difficulty | undefined;
  onChange: (value: Difficulty | undefined) => void;
  optional?: boolean;
  label: string;
}

export default function DifficultyPicker({ value, onChange, optional = false, label }: Props) {
  return (
    <fieldset>
      <legend className="text-sm font-medium text-ink-700 dark:text-ink-300">{label}</legend>
      <div className="mt-1 flex flex-wrap gap-2">
        {DIFFICULTIES.map((d) => (
          <label
            key={d}
            className={`cursor-pointer rounded-full px-3 py-1 text-sm capitalize ring-1 ${
              value === d
                ? "bg-brand-600 dark:bg-brand-400 text-brand-400 dark:text-brand-600 ring-brand-600 dark:ring-brand-400"
                : "bg-white text-ink-700 ring-ink-300 hover:bg-ink-50 dark:bg-ink-900 dark:text-ink-300 dark:ring-ink-700 dark:hover:bg-ink-800"
            }`}
          >
            <input
              type="radio"
              name={label}
              value={d}
              checked={value === d}
              onChange={() => onChange(d)}
              className="sr-only"
            />
            {d}
          </label>
        ))}
        {optional && value && (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="text-sm text-ink-500 hover:text-ink-900 dark:hover:text-white"
          >
            Clear
          </button>
        )}
      </div>
    </fieldset>
  );
}
