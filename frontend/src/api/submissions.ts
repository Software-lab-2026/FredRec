import type { Domain, ReviewInput, Submission, SubmissionInput } from "../types/curation";
import { apiFetch } from "./client";

const post = (body: unknown) => ({ method: "POST", body: JSON.stringify(body) });

export function createSubmission(input: SubmissionInput): Promise<Submission> {
  return apiFetch<Submission>("/submissions", post(input));
}

export function listMySubmissions(): Promise<Submission[]> {
  return apiFetch<Submission[]>("/submissions/mine");
}

// Domain experts 

export function getMyExpertDomains(): Promise<Domain[]> {
  return apiFetch<Domain[]>("/expert/domains");
}

export function getExpertQueue(): Promise<Submission[]> {
  return apiFetch<Submission[]>("/expert/queue");
}

export function expertApprove(id: string, review: ReviewInput): Promise<Submission> {
  return apiFetch<Submission>(`/expert/submissions/${id}/approve`, post(review));
}

export function expertReject(id: string, reason: string): Promise<Submission> {
  return apiFetch<Submission>(`/expert/submissions/${id}/reject`, post({ reason }));
}

//Admin

//expert aproved resources
export function getAdminQueue(): Promise<Submission[]> {
  return apiFetch<Submission[]>("/admin/queue");
}

export function adminApprove(id: string, review: ReviewInput): Promise<Submission> {
  return apiFetch<Submission>(`/admin/submissions/${id}/approve`, post(review));
}

export function adminReject(id: string, reason: string): Promise<Submission> {
  return apiFetch<Submission>(`/admin/submissions/${id}/reject`, post({ reason }));
}

// lists published resources
export function listCurated(): Promise<Submission[]> {
  return apiFetch<Submission[]>("/admin/curated");
}

export function archiveResource(id: string): Promise<Submission> {
  return apiFetch<Submission>(`/admin/submissions/${id}/archive`, { method: "POST" });
}
