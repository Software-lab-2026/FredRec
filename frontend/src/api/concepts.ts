import type { DomainGraph, NewConcept, NewEdge } from "../types/concepts.ts";
import { apiFetch } from "./client";

export function getDomainGraph(domainId: string): Promise<DomainGraph> {
  return apiFetch<DomainGraph>(`/domains/${domainId}/graph`);
}

export function createConcept(input: NewConcept): Promise<DomainGraph> {
  return apiFetch<DomainGraph>("/expert/concepts", { method: "POST", body: JSON.stringify(input) });
}

export function updateConcept(id: string, changes: { name?: string; description?: string }): Promise<DomainGraph> {
  return apiFetch<DomainGraph>(`/expert/concepts/${id}`, { method: "PATCH", body: JSON.stringify(changes) });
}

export function deleteConcept(id: string): Promise<void> {
  return apiFetch<void>(`/expert/concepts/${id}`, { method: "DELETE" });
}

export function createEdge(input: NewEdge): Promise<DomainGraph> {
  return apiFetch<DomainGraph>("/expert/edges", { method: "POST", body: JSON.stringify(input) });
}

export function deleteEdge(id: string): Promise<void> {
  return apiFetch<void>(`/expert/edges/${id}`, { method: "DELETE" });
}
