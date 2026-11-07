export const domainKeys = {
  all: ["domains"] as const,
  mine: (userId: string) => ["domains", "mine", userId] as const,
};


export const curationKeys = {
  all: ["curation"] as const,
  mine: (userId: string) => ["curation", "mine", userId] as const,
  expertQueue: (userId: string) => ["curation", "expert", userId] as const,
  adminQueue: ["curation", "admin"] as const,
  curated: ["curation", "curated"] as const,
  experts: ["curation", "experts"] as const,
};

export const graphKeys = {
  domain: (domainId: string) => ["graph", domainId] as const,
};

export const statsKeys = {
  admin: (days: number) => ["stats", "admin", days] as const,
  expert: (userId: string, days: number) => ["stats", "expert", userId, days] as const,
};
