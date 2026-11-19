import { useDomains } from "../hooks/useDomains";

interface Props {
  selected: string[];                 // domain ids that are ticked
  onChange: (ids: string[]) => void;  // parent receives the new list
}

export default function DomainCheckboxes({ selected, onChange }: Props) {
  const { domains, isLoading } = useDomains();
  if (isLoading) return <p className="text-sm text-slate-500">Loading domains…</p>;

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {domains.map((d) => (
        <label key={d.id} className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={selected.includes(d.id)} onChange={() => toggle(d.id)} />
          {d.name}
        </label>
      ))}
    </div>
  );
}