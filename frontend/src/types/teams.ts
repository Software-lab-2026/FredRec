import type { Workspace } from "./resource";

export type TeamRole = "owner" | "editor" | "viewer";

export const TEAM_ROLE_LABELS: Record<TeamRole, string> = {
  owner: "Owner",
  editor: "Editor",
  viewer: "Viewer",
};

export interface Team {
  id: string;
  name: string;
  myRole: TeamRole;
  memberCount: number;
  createdAt: string;
}

export interface TeamMember {
  userId: string;
  username: string;
  role: TeamRole;
  joinedAt: string;
}

export interface TeamInvite {
  id: string;
  // Username, or an email address for someone without an account yet
  invitee: string;
  role: TeamRole;
  createdAt: string;
}

export interface TeamDetail extends Team {
  members: TeamMember[];
  invites: TeamInvite[];
  workspaces: Workspace[];
}

export interface MyInvite {
  id: string;
  teamId: string;
  teamName: string;
  role: TeamRole;
  invitedBy: string;
  createdAt: string;
}
