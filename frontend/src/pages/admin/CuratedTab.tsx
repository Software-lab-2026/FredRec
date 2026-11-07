import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { archiveResource, listCurated } from "../../api/submissions";
import StatusBadge from "../../components/StatusBadge";
import { cardClass, dangerButton, errorText } from "../../components/styles";
import { curationKeys } from "../../hooks/curationKeys";
import { useDomains } from "../../hooks/useDomains";
import { FORMAT_LABELS } from "../../types/resource";
import Loader from "../../components/Loader";


export default function CuratedTab() {
  const queryClient = useQueryClient();
  const { domainName } = useDomains();
  const curated = useQuery({ queryKey: curationKeys.curated, queryFn: listCurated });

  const archive = useMutation({
    mutationFn: archiveResource,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: curationKeys.all });
      await queryClient.invalidateQueries({ queryKey: ["search"] });
    },
  });

  if (curated.isPending) return <Loader />;
  if (curated.isSuccess && curated.data.length === 0) {
    return <p className="text-ink-600 dark:text-ink-400">No curated resources have been published yet.</p>;
  }

  return (
    <div>
      {archive.isError && <p className={`mb-3 ${errorText}`}>{archive.error.message}</p>}
      <ul className="space-y-3">
        {curated.data?.map((s) => (
          <li key={s.id} className={`flex flex-wrap items-center gap-3 ${cardClass}`}>
            <div className="min-w-0 flex-1">
              <StatusBadge status={s.status} />
              <a
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="mt-1 block font-semibold hover:text-brand-600 dark:hover:text-brand-400"
              >
                {s.title}
              </a>
              <p className="text-xs text-ink-500">
                {domainName(s.domainId)} › {s.topic} · {FORMAT_LABELS[s.format]} ·{" "}
                <span className="capitalize">{s.difficulty}</span>
                {s.publishedAt && ` · published ${new Date(s.publishedAt).toLocaleDateString()}`}
              </p>
            </div>
            {s.status === "published" && (
              <button
                onClick={() => {
                  if (confirm(`Archive “${s.title}”? It will no longer appear in search.`)) archive.mutate(s.id);
                }}
                disabled={archive.isPending}
                className={dangerButton}
              >
                Archive
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
