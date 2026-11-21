export const teamKeys = {
  all: (userId: string) => ["teams", userId] as const,
  list: (userId: string) => ["teams", userId, "list"] as const,
  detail: (userId: string, id: string) => ["teams", userId, "detail", id] as const,
  invites: (userId: string) => ["teams", userId, "invites"] as const,
};
