import type { Resource } from '../types/resource'

/**
 * Fake search results used while there is no backend (USE_MOCKS = true).
 * Key = the exact topic name from data/topics.ts.
 * urlHash is normally a hash of the URL made by the backend; here it is just a short unique id.
 */
export const MOCK_RESULTS: Record<string, Resource[]> = {
  'Operating Systems': [
    {
      url: 'https://pages.cs.wisc.edu/~remzi/OSTEP/',
      urlHash: 'ostep',
      title: 'Operating Systems: Three Easy Pieces',
      format: 'textbook',
      source: 'OSTEP',
      description: 'Free OS textbook covering virtualization, concurrency and persistence.',
      authors: ['Remzi Arpaci-Dusseau', 'Andrea Arpaci-Dusseau'],
      difficulty: 'beginner',
      avgRating: 4.8,
      reviewCount: 120,
    },
    {
      url: 'https://pdos.csail.mit.edu/6.1810/',
      urlHash: 'mit-6-1810',
      title: 'MIT 6.1810: Operating System Engineering',
      format: 'course',
      source: 'MIT',
      description: 'Hands-on OS course built around the xv6 teaching kernel.',
      authors: ['MIT PDOS'],
      difficulty: 'advanced',
    },
    {
      url: 'https://github.com/mit-pdos/xv6-riscv',
      urlHash: 'xv6-riscv',
      title: 'xv6-riscv source code',
      format: 'repo',
      source: 'GitHub',
      description: 'A small Unix-like teaching kernel you can read in a weekend.',
      authors: ['MIT PDOS'],
      difficulty: 'intermediate',
    },
  ],
  'Machine Learning': [
    {
      url: 'https://cs229.stanford.edu/',
      urlHash: 'cs229',
      title: 'Stanford CS229: Machine Learning',
      format: 'course',
      source: 'Stanford',
      description: 'Lecture notes and problem sets for the classic ML course.',
      authors: ['Stanford University'],
      difficulty: 'intermediate',
      avgRating: 4.6,
      reviewCount: 85,
    },
    {
      url: 'https://d2l.ai/',
      urlHash: 'd2l',
      title: 'Dive into Deep Learning',
      format: 'textbook',
      source: 'd2l.ai',
      description: 'Interactive deep learning book with runnable code.',
      authors: ['Aston Zhang', 'Zachary Lipton', 'Mu Li', 'Alexander Smola'],
      difficulty: 'intermediate',
    },
    {
      url: 'https://github.com/scikit-learn/scikit-learn',
      urlHash: 'sklearn',
      title: 'scikit-learn',
      format: 'repo',
      source: 'GitHub',
      description: 'The standard Python library for classical machine learning.',
      authors: ['scikit-learn developers'],
      difficulty: 'beginner',
    },
  ],
  'Computer Networks': [
    {
      url: 'https://book.systemsapproach.org/',
      urlHash: 'systems-approach',
      title: 'Computer Networks: A Systems Approach',
      format: 'textbook',
      source: 'systemsapproach.org',
      description: 'Free, open-source networking textbook.',
      authors: ['Larry Peterson', 'Bruce Davie'],
      difficulty: 'beginner',
    },
  ],
}