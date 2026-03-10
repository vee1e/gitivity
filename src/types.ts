export interface ContributorStats {
  username: string;
  avatarUrl: string;
  totalPRs: number;
  mergedPRs: number;
  openPRs: number;
  closedPRs: number;
  isMaintainer: boolean; // Change from optional to required
  isBot: boolean;
}

export interface OrganizationActiveUserStats {
  username: string;
  avatarUrl: string;
  totalPRs: number;
  mergedPRs: number;
  openPRs: number;
  closedPRs: number;
  repositoriesContributed: number;
  isMaintainer: boolean;
  isBot: boolean;
}

export interface OrganizationActiveUsersResult {
  organization: string;
  scannedRepos: number;
  totalReposConsidered: number;
  users: OrganizationActiveUserStats[];
}

export interface PullRequest {
  number: number;
  title: string;
  state: string;
  created_at: string;
  merged_at: string | null;
  html_url: string;
  repository_url: string;
  repository_name?: string;
  user: {
    login: string;
    avatar_url: string;
    type?: string;
  };
}

export interface RepoStats {
  totalPRs: number;
  contributors: ContributorStats[];
  recentPRs: PullRequest[];
  organizationActiveUsers?: OrganizationActiveUserStats[];
  orgAnalysisResult?: OrganizationActiveUsersResult;
}

export interface UserStats {
  username: string;
  avatarUrl: string;
  repositories: {
    [key: string]: {
      totalPRs: number;
      mergedPRs: number;
      openPRs: number;
      closedPRs: number;
    };
  };
  pullRequests: PullRequest[];
  totalStats: {
    totalPRs: number;
    mergedPRs: number;
    openPRs: number;
    closedPRs: number;
  };
  isMaintainer: boolean; // Make this required
}

export type TimeFilter = "2w" | "1m" | "3m" | "6m" | "all";
