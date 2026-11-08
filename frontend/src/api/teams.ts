import type { Workspace } from "../types/resource";
import type { MyInvite, Team, TeamDetail, TeamRole } from "../types/teams";
import { apiFetch } from "./client";

const json = (method: string, body?: unknown) => ({ method, body: body === undefined ? undefined : JSON.stringify(body) });

export function listTeams(): Promise<Team[]> {
  return apiFetch<Team[]>("/teams");
}

export function createTeam(name: string): Promise<TeamDetail> {
  return apiFetch<TeamDetail>("/teams", json("POST", { name }));
}

export function getTeam(id: string): Promise<TeamDetail> {
  return apiFetch<TeamDetail>(`/teams/${id}`);
}

export function renameTeam(id: string, name: string): Promise<TeamDetail> {
  return apiFetch<TeamDetail>(`/teams/${id}`, json("PATCH", { name }));
}

export function deleteTeam(id: string): Promise<void> {
  return apiFetch<void>(`/teams/${id}`, json("DELETE"));
}

export function inviteToTeam(teamId: string, invitee: string, role: TeamRole): Promise<TeamDetail> {
  return apiFetch<TeamDetail>(`/teams/${teamId}/invites`, json("POST", { invitee, role }));
}

export function revokeInvite(teamId: string, inviteId: string): Promise<void> {
  return apiFetch<void>(`/teams/${teamId}/invites/${inviteId}`, json("DELETE"));
}

export function changeMemberRole(teamId: string, userId: string, role: TeamRole): Promise<TeamDetail> {
  return apiFetch<TeamDetail>(`/teams/${teamId}/members/${userId}`, json("PATCH", { role }));
}

export function removeMember(teamId: string, userId: string): Promise<void> {
  return apiFetch<void>(`/teams/${teamId}/members/${userId}`, json("DELETE"));
}

export function createTeamWorkspace(teamId: string, name: string): Promise<Workspace> {
  return apiFetch<Workspace>(`/teams/${teamId}/workspaces`, json("POST", { name: name.trim() }));
}

export function listMyInvites(): Promise<MyInvite[]> {
  return apiFetch<MyInvite[]>("/invites");
}

export function acceptInvite(id: string): Promise<TeamDetail> {
  return apiFetch<TeamDetail>(`/invites/${id}/accept`, json("POST"));
}

export function declineInvite(id: string): Promise<void> {
  return apiFetch<void>(`/invites/${id}/decline`, json("POST"));
}
