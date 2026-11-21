import type { Difficulty, ResourceFormat } from "./resource";

//managed by admin
export interface Domain {
  id: string;
  name: string;
  description: string;
  topics: string[];
}

export type SubmissionStatus =
  | "pending_expert"
  | "pending_admin"
  | "published"
  | "rejected"
  | "archived";

export type SubmissionAction =
  | "suggested"
  | "requested"
  | "added"
  | "expert_approved"
  | "expert_rejected"
  | "admin_approved"
  | "admin_rejected"
  | "archived";

export interface SubmissionEvent {
  action: SubmissionAction;
  actor: string;
  note?: string;
  at: string;
}

// An user Suggested resource flow : suggestion → expert → admin → published
export interface Submission {
  id: string;
  url: string;
  urlHash: string;
  title: string;
  description: string;
  format: ResourceFormat;
  domainId: string;
  topic: string;
  suggestedDifficulty?: Difficulty; // given by enduser
  difficulty?: Difficulty; //set by expert
  status: SubmissionStatus;
  submittedBy: { id: string; username: string };
  createdAt: string;
  publishedAt?: string;
  events: SubmissionEvent[];
  noActiveExperts?: boolean;
}

export interface SubmissionInput {
  url: string;
  title: string;
  description: string;
  format: ResourceFormat;
  domainId: string;
  topic: string;
  difficulty?: Difficulty;
}

export interface ReviewInput {
  title: string;
  format: ResourceFormat;
  topic: string;
  difficulty: Difficulty;
  note: string;
}

export interface ExpertAccount {
  id: string;
  username: string;
  email: string;
  domainIds: string[];
  isActive: boolean;
  mustChangePassword: boolean;
}

export interface NewExpertInput {
  username: string;
  email: string;
  password: string;
  domainIds: string[];
}

export const STATUS_LABELS: Record<SubmissionStatus, string> = {
  pending_expert: "Waiting for expert review",
  pending_admin: "Waiting for admin approval",
  published: "Published",
  rejected: "Rejected",
  archived: "Archived",
};
