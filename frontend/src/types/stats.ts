export interface DayCount {
  day: string;
  matched: number;
  unmatched: number;
}

export interface NameCount {
  name: string;
  count: number;
}

export interface AdminStats {
  days: number;
  totals: {
    learners: number;
    experts: number;
    publishedResources: number;
    waitingForAdmin: number;
    searches: number;
    unmatchedSearches: number;
  };
  searchesPerDay: DayCount[];
  topTopics: NameCount[];
  pipeline: {
    waitingForExpert: number;
    waitingForAdmin: number;
    published: number;
    rejected: number;
    medianHoursToPublish: number | null;
  };
}

export interface ExpertStats {
  days: number;
  totals: { waiting: number; myReviews: number; concepts: number; searches: number };
  topSearches: NameCount[];
  topics: { topic: string; concepts: number; published: number }[];
  difficulty: NameCount[];
}
