import type { ExpertAccount, NewExpertInput } from "../types/curation";
import { apiFetch } from "./client";

export function listExperts(): Promise<ExpertAccount[]> {
  return apiFetch<ExpertAccount[]>("/admin/experts");
}

// Temporary expert created , requires to change passwd on login
export function createExpert(input: NewExpertInput): Promise<ExpertAccount> {
  return apiFetch<ExpertAccount>("/admin/experts", { method: "POST", body: JSON.stringify(input) });
}

export function updateExpert(id: string, changes: { domainIds?: string[]; isActive?: boolean }): Promise<ExpertAccount> {
  return apiFetch<ExpertAccount>(`/admin/experts/${id}`, { method: "PATCH", body: JSON.stringify(changes) });
}
