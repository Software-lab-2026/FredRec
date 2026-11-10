export const TOPIC_ALIASES: Record<string, string> = {
  dsa: 'Data Structures & Algorithms',
  dp: 'Dynamic Programming',
  oop: 'Object-Oriented Programming',
  oops: 'Object-Oriented Programming',
  os: 'Operating Systems',
  cn: 'Computer Networks',
  dbms: 'Database Management Systems',
  coa: 'Computer Organization and Architecture',
  toc: 'Theory of Computation',
  sdlc: 'Software Development Life Cycle',
  ml: 'Machine Learning',
  dl: 'Deep Learning',
  nlp: 'Natural Language Processing',
  cv: 'Computer Vision',
  rl: 'Reinforcement Learning',
  genai: 'Generative AI',
  hci: 'Human-Computer Interaction',
  k8s: 'Kubernetes',
}

export function suggestTopics(topics: string[], query: string, limit = 8): string[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const alias = TOPIC_ALIASES[q]
  const aliasMatch = alias && topics.includes(alias) ? alias : undefined
  const matches = topics.filter((t) => t.toLowerCase().includes(q) && t !== aliasMatch)
  return (aliasMatch ? [aliasMatch, ...matches] : matches).slice(0, limit)
}