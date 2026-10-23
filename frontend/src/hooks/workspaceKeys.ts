export const workspaceKeys = {
  all: (userId: string) => ['ws', userId] as const,
  list: (userId: string) => ['ws', userId, 'list'] as const,
  detail: (userId: string, id: string) => ['ws', userId, 'detail', id] as const,
  savedIndex: (userId: string) => ['ws', userId, 'savedIndex'] as const,
}

