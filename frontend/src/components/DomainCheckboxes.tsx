import type { Domain } from "../types/curation";

export default function DomainCheckboxes({
  domains,
  selected,
  onChange,
}: {
  domains: Domain[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  return (
    <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
      {domains.map((d) => (
        <label key={d.id} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={selected.includes(d.id)}
            onChange={(e) => onChange(e.target.checked ? [...selected, d.id] : selected.filter((id) => id !== d.id))}
            className="h-4 w-4 accent-brand-600"
          />
          {d.name}
        </label>
      ))}
    </div>
  );
}
