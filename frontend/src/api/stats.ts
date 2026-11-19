import type { AdminStats, ExpertStats } from "../types/stats";
import { apiFetch } from "./client";

export function getAdminStats(days: number): Promise<AdminStats> {
  return apiFetch<AdminStats>(`/admin/stats?days=${days}`);
}

export function getExpertStats(days: number): Promise<ExpertStats> {
  return apiFetch<ExpertStats>(`/expert/stats?days=${days}`);
}

