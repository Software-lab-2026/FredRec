import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createDomain, deleteDomain, renameDomain } from "../../api/admin";
import { btnDanger, btnPrimary, btnSecondary, card, input } from "../../components/styles";
import { domainKeys } from "../../hooks/curationKeys";
import { useDomains } from "../../hooks/useDomains";

export default function DomainsTab() {
  const { domains, isLoading } = useDomains();
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: domainKeys.all });

  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const create = useMutation({
    mutationFn: (name: string) => createDomain(name),
    onSuccess: () => { refresh(); setNewName(""); },
  });
  const rename = useMutation({
    mutationFn: (v: { id: string; name: string }) => renameDomain(v.id, v.name),
    onSuccess: () => { refresh(); setEditingId(null); },
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteDomain(id),
    onSuccess: refresh,
  });

  const error = create.error ?? rename.error ?? remove.error;

  return (
    <div className="space-y-4">
      <form
        className="flex gap-2"
        onSubmit={(e) => { e.preventDefault(); create.mutate(newName); }}
      >
        <input
          className={input}
          placeholder="New domain name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button className={btnPrimary} disabled={!newName.trim() || create.isPending}>
          Add
        </button>
      </form>

      {error && <p className="text-sm text-rose-600">{error.message}</p>}
      {isLoading && <p className="text-slate-500">Loading…</p>}

      {domains.map((d) => (
        <div key={d.id} className={`${card} flex items-center justify-between gap-3`}>
          {editingId === d.id ? (
            <input
              className={input}
              value={editName}
              autoFocus
              onChange={(e) => setEditName(e.target.value)}
            />
          ) : (
            <div>
              <p className="font-medium">{d.name}</p>
              <p className="text-sm text-slate-500">{d.topics.length} topics</p>
            </div>
          )}

          <div className="flex gap-2">
            {editingId === d.id ? (
              <>
                <button
                  className={btnPrimary}
                  disabled={!editName.trim() || rename.isPending}
                  onClick={() => rename.mutate({ id: d.id, name: editName })}
                >
                  Save
                </button>
                <button className={btnSecondary} onClick={() => setEditingId(null)}>
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  className={btnSecondary}
                  onClick={() => { setEditingId(d.id); setEditName(d.name); }}
                >
                  Rename
                </button>
                <button
                  className={btnDanger}
                  disabled={remove.isPending}
                  onClick={() => { if (confirm(`Delete “${d.name}”?`)) remove.mutate(d.id); }}
                >
                  Delete
                </button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}