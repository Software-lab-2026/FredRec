export interface TopicDomain {
  domain: string
  topics: string[]
}

export const TOPIC_DOMAINS: TopicDomain[] = [
  {
    domain: 'Programming Fundamentals',
    topics: ['Python', 'C', 'C++', 'Java', 'JavaScript', 'Object-Oriented Programming', 'Functional Programming', 'Recursion'],
  },
  {
    domain: 'Data Structures & Algorithms',
    topics: [
      'Data Structures & Algorithms', 'Arrays', 'Linked Lists', 'Stacks and Queues', 'Trees', 'Graphs', 'Hashing', 'Heaps',
      'Sorting and Searching', 'Dynamic Programming', 'Greedy Algorithms', 'Backtracking', 'Competitive Programming',
    ],
  },
  {
    domain: 'Math & Theory',
    topics: [
      'Discrete Mathematics', 'Probability and Statistics', 'Linear Algebra for CS',
      'Theory of Computation', 'Compiler Design', 'Complexity Theory',
    ],
  },
  {
    domain: 'Systems',
    topics: ['Computer Organization and Architecture', 'Digital Logic', 'Operating Systems', 'Systems Programming', 'Embedded Systems'],
  },
  {
    domain: 'Networks & Security',
    topics: ['Computer Networks', 'Network Security', 'Cryptography', 'Ethical Hacking', 'Web Security'],
  },
  {
    domain: 'Databases & Data',
    topics: ['Database Management Systems', 'SQL', 'NoSQL', 'Data Warehousing', 'Big Data', 'Data Engineering'],
  },
  {
    domain: 'Software Engineering',
    topics: ['Software Development Life Cycle', 'Design Patterns', 'Software Testing', 'Git', 'System Design', 'Microservices'],
  },
  {
    domain: 'Web & Mobile',
    topics: ['HTML and CSS', 'Frontend Frameworks', 'Backend Development', 'REST and GraphQL APIs', 'Android Development', 'iOS Development', 'Flutter'],
  },
  {
    domain: 'AI / ML / Data Science',
    topics: [
      'Machine Learning', 'Deep Learning', 'Natural Language Processing', 'Computer Vision',
      'Reinforcement Learning', 'Data Analysis', 'Generative AI',
    ],
  },
  {
    domain: 'Cloud & DevOps',
    topics: ['Cloud Computing', 'Docker', 'Kubernetes', 'CI/CD', 'Linux'],
  },
  {
    domain: 'Distributed & Parallel',
    topics: ['Distributed Systems', 'Parallel Computing', 'Blockchain'],
  },
  {
    domain: 'Other',
    topics: ['Computer Graphics', 'Human-Computer Interaction', 'Quantum Computing', 'Interview Preparation'],
  },
]

export const ALL_TOPICS: string[] = TOPIC_DOMAINS.flatMap((d) => d.topics)

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

export function resolveTopic(query: string): string | undefined {
  const q = query.trim().toLowerCase()
  return TOPIC_ALIASES[q] ?? ALL_TOPICS.find((t) => t.toLowerCase() === q)
}

export function suggestTopics(query: string, limit = 8): string[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const alias = TOPIC_ALIASES[q]
  const matches = ALL_TOPICS.filter((t) => t.toLowerCase().includes(q) && t !== alias)
  return (alias ? [alias, ...matches] : matches).slice(0, limit)
}

