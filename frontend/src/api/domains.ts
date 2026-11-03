import type { Domain } from "../types/curation";
import { apiFetch } from "./client";

export function listDomains(): Promise<Domain[]> {
  return apiFetch<Domain[]>("/domains");
}

export function createDomain(name: string, description: string): Promise<Domain> {
  return apiFetch<Domain>("/admin/domains", { method: "POST", body: JSON.stringify({ name, description }) });
}

export function renameDomain(id: string, name: string): Promise<Domain> {
  return apiFetch<Domain>(`/admin/domains/${id}`, { method: "PATCH", body: JSON.stringify({ name }) });
}

export function addTopic(domainId: string, topic: string, description = ""): Promise<Domain> {
  return apiFetch<Domain>(`/admin/domains/${domainId}/topics`, {
    method: "POST",
    body: JSON.stringify({ name: topic, description }),
  });
}
