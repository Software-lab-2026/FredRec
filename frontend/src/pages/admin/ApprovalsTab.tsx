import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApprove, adminReject, getAdminQueue } from "../../api/submissions";
import ReviewCard from "../../components/ReviewCard";
import { curationKeys } from "../../hooks/curationKeys";
import { useDomains } from "../../hooks/useDomains";
import Loader from "../../components/Loader";

//expert approved suggestions + no active domain experts.
export default function ApprovalsTab() {
  const queryClient = useQueryClient();
  const { domains } = useDomains();
  const queue = useQuery({ queryKey: curationKeys.adminQueue, queryFn: getAdminQueue });

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: curationKeys.all });
    await queryClient.invalidateQueries({ queryKey: ["search"] });
  }

  if (queue.isPending) return <Loader />;
  if (queue.isError) return <p className="text-rose-600">{queue.error.message}</p>;
  if (queue.data.length === 0) {
    return <p className="text-ink-600 dark:text-ink-400">Nothing waiting for approval. 🎉</p>;
  }


  const items = [...queue.data].sort((a, b) => Number(a.status !== "pending_admin") - Number(b.status !== "pending_admin"));

  return (
    <div className="space-y-4">
      {items.map((s) => (
        <ReviewCard
          key={s.id}
          submission={s}
          domain={domains.find((d) => d.id === s.domainId)}
          mode="admin"
          onApprove={async (review) => {
            await adminApprove(s.id, review);
            await refresh();
          }}
          onReject={async (reason) => {
            await adminReject(s.id, reason);
            await refresh();
          }}
        />
      ))}
    </div>
  );
}
