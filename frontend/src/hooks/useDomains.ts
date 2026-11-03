import { useQuery } from "@tanstack/react-query";
import { listDomains } from "../api/domains";
import { domainKeys } from "./curationKeys";

// All domains & topics 
export function useDomains() {
  const query = useQuery({ queryKey: domainKeys.all, queryFn: listDomains });
  const domains = query.data ?? [];
  return {
    ...query,
    domains,
    allTopics: domains.flatMap((d) => d.topics),
    domainName: (id: string) => domains.find((d) => d.id === id)?.name ?? id,
  };
}
