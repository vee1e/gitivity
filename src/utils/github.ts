import { Octokit } from "octokit";
import { subDays, parseISO, isAfter } from "date-fns";
import type {
  ContributorStats,
  PullRequest,
  RepoStats,
  UserStats,
  TimeFilter,
  OrganizationActiveUserStats,
  OrganizationActiveUsersResult,
} from "../types";
import { getGitHubToken } from "./env";

// Add simple in-memory cache
const cache: Record<string, { data: unknown; timestamp: number }> = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

// Helper to get cached data or fetch new data
const getCachedOrFetch = async <T>(
  key: string,
  fetchFn: () => Promise<T>,
): Promise<T> => {
  const now = Date.now();
  const cachedItem = cache[key];

  if (cachedItem && now - cachedItem.timestamp < CACHE_TTL) {
    return cachedItem.data as T;
  }

  const data = await fetchFn();
  cache[key] = { data, timestamp: now };
  return data;
};

// Cache for maintainer data to avoid repeated API calls
const maintainerCache: Record<
  string,
  { usernames: Set<string>; timestamp: number }
> = {};
const MAINTAINER_CACHE_TTL = 60 * 60 * 1000; // 1 hour cache for maintainer status

export const parseGitHubUrl = (
  url: string,
): { owner: string; repo: string } | null => {
  try {
    // Clean and normalize the input
    let normalizedUrl = url.trim();

    // Remove trailing slashes, .git extension
    normalizedUrl = normalizedUrl.replace(/\.git\/?$/, "").replace(/\/$/, "");

    // Case 1: Simple "owner/repo" format
    if (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(normalizedUrl)) {
      const [owner, repo] = normalizedUrl.split("/");
      return { owner, repo };
    }

    // Case 2: github.com/owner/repo (without protocol)
    if (/^github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+/.test(normalizedUrl)) {
      const parts = normalizedUrl.split("/");
      return { owner: parts[1], repo: parts[2] };
    }

    // Case 3: Add protocol if needed for URL parsing
    if (!normalizedUrl.startsWith("http")) {
      normalizedUrl = "https://" + normalizedUrl;
    }

    // Parse as URL
    const urlObj = new URL(normalizedUrl);

    // Verify it's a GitHub URL
    if (!urlObj.hostname.endsWith("github.com")) {
      return null;
    }

    // Extract path components
    const pathParts = urlObj.pathname.split("/").filter(Boolean);

    // Need at least owner and repo
    if (pathParts.length < 2) {
      return null;
    }

    return {
      owner: pathParts[0],
      repo: pathParts[1],
    };
  } catch (err) {
    console.warn("Error parsing GitHub URL:", err, url);
    return null;
  }
};

const getTimeFilterDate = (filter: TimeFilter): Date => {
  const now = new Date();
  switch (filter) {
    case "2w":
      return subDays(now, 14);
    case "1m":
      return subDays(now, 30);
    case "3m":
      return subDays(now, 90);
    case "6m":
      return subDays(now, 180);
    default:
      return new Date(0); // Beginning of time
  }
};

// Improved maintainer detection with optimized caching strategy
async function fetchMaintainers(
  octokit: Octokit,
  owner: string,
  repo: string,
  quiet: boolean = false,
): Promise<Set<string>> {
  const cacheKey = `maintainers_${owner}_${repo}`;
  const now = Date.now();
  const cachedItem = maintainerCache[cacheKey];

  if (cachedItem && now - cachedItem.timestamp < MAINTAINER_CACHE_TTL) {
    console.log(
      `Using cached maintainers for ${owner}/${repo}: ${cachedItem.usernames.size} maintainers`,
    );
    return cachedItem.usernames;
  }

  try {
    if (!quiet) {
      emitLoadingProgress("Fetching collaborators...", {
        stage: "collaborators",
        percentage: 5,
        completed: 0,
        total: 1,
      });
    }
    // Use explicit 'all' permission parameter to ensure we get everyone with push access
    const { data: collaborators } = await octokit.request(
      "GET /repos/{owner}/{repo}/collaborators",
      {
        owner,
        repo,
        affiliation: "all",
        per_page: 100,
        headers: {
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
    );

    // Create set of maintainers (users with push or admin access)
    const maintainers = new Set(
      collaborators
        .filter(
          (collab: { permissions?: { push?: boolean; admin?: boolean } }) =>
            collab.permissions?.push === true ||
            collab.permissions?.admin === true,
        )
        .map((collab: { login: string }) => collab.login),
    );

    maintainerCache[cacheKey] = { usernames: maintainers, timestamp: now };
    console.log(
      `Found ${maintainers.size} maintainers for ${owner}/${repo}: ${[...maintainers].join(", ")}`,
    );
    return maintainers;
  } catch (error) {
    console.warn(`Could not fetch collaborators for ${owner}/${repo}:`, error);
    return new Set(); // Return empty set as fallback
  }
}

// Global repository maintainers map to avoid duplicate API calls
const repoMaintainersMap: Map<string, Promise<Set<string>>> = new Map();

// Optimized function to get maintainers with deduplication of in-flight requests
async function getMaintainers(
  octokit: Octokit,
  owner: string,
  repo: string,
  quiet: boolean = false,
): Promise<Set<string>> {
  const key = `${owner}/${repo}`;

  // If we already have a request in flight for this repository, reuse it
  if (!repoMaintainersMap.has(key)) {
    const promise = fetchMaintainers(octokit, owner, repo, quiet);
    repoMaintainersMap.set(key, promise);

    // Clean up the map after the request is complete
    promise.finally(() => {
      setTimeout(() => repoMaintainersMap.delete(key), 5000); // Remove after 5 seconds
    });
  }

  return repoMaintainersMap.get(key) as Promise<Set<string>>;
}

// Modified function to create Octokit instance with token if available
function createOctokit(): Octokit {
  const token = getGitHubToken();
  if (token) {
    return new Octokit({ auth: token });
  }
  return new Octokit();
}

const aggregateOrganizationActiveUsers = (
  pullRequests: PullRequest[],
  maintainersMap: Map<string, Set<string>>,
): OrganizationActiveUserStats[] => {
  type AggregatedOrgUser = {
    username: string;
    avatarUrl: string;
    totalPRs: number;
    mergedPRs: number;
    openPRs: number;
    closedPRs: number;
    repositoriesContributed: number;
    repos: Set<string>;
    isMaintainer: boolean;
    isBot: boolean;
  };
  const userMap = new Map<string, AggregatedOrgUser>();

  for (const pr of pullRequests) {
    const repoName = pr.repository_name;
    if (!repoName) {
      continue;
    }

    const username = pr.user.login;
    const isBot = pr.user.type === "Bot" || username.toLowerCase().includes("[bot]");
    const isMaintainer = maintainersMap.get(repoName)?.has(username) || false;

    const current = userMap.get(username) ?? {
      username,
      avatarUrl: pr.user.avatar_url,
      totalPRs: 0,
      mergedPRs: 0,
      openPRs: 0,
      closedPRs: 0,
      repositoriesContributed: 0,
      repos: new Set<string>(),
      isMaintainer: false,
      isBot,
    };

    if (isMaintainer) {
      current.isMaintainer = true;
    }

    current.totalPRs += 1;
    if (pr.merged_at) {
      current.mergedPRs += 1;
    } else if (pr.state === "open") {
      current.openPRs += 1;
    } else {
      current.closedPRs += 1;
    }

    current.repos.add(repoName);
    current.repositoriesContributed = current.repos.size;
    userMap.set(username, current);
  }

  return Array.from(userMap.values())
    .map((user) => ({
      username: user.username,
      avatarUrl: user.avatarUrl,
      totalPRs: user.totalPRs,
      mergedPRs: user.mergedPRs,
      openPRs: user.openPRs,
      closedPRs: user.closedPRs,
      repositoriesContributed: user.repositoriesContributed,
      isMaintainer: user.isMaintainer,
      isBot: user.isBot,
    }))
    .sort(
      (a, b) =>
        b.mergedPRs - a.mergedPRs ||
        b.totalPRs - a.totalPRs ||
        b.openPRs - a.openPRs,
    );
};

export const fetchRepoStats = async (
  repoUrl: string,
  timeFilter: TimeFilter,
): Promise<RepoStats> => {
  const repoInfo = parseGitHubUrl(repoUrl);

  if (!repoInfo) {
    throw new Error(
      "Invalid GitHub repository URL. Please use one of these formats:\n" +
      "- owner/repo\n" +
      "- github.com/owner/repo\n" +
      "- https://github.com/owner/repo",
    );
  }

  console.log(`Fetching stats for ${repoInfo.owner}/${repoInfo.repo}`);

  const cacheKey = `repo_${repoInfo.owner}_${repoInfo.repo}_${timeFilter}`;
  return getCachedOrFetch(cacheKey, async () => {
    // Use our new createOctokit function to get an authenticated instance
    const octokit = createOctokit();
    const filterDate = getTimeFilterDate(timeFilter);

    // Use optimized maintainer fetching
    emitLoadingProgress("Fetching repository information...", {
      stage: "repo",
      percentage: 5,
      completed: 0,
      total: 1,
    });
    let maintainers: Set<string>;
    try {
      maintainers = await getMaintainers(
        octokit,
        repoInfo.owner,
        repoInfo.repo,
      );
    } catch (error) {
      console.error("Failed to fetch maintainers:", error);
      maintainers = new Set();
    }

    // Single-repo pull request fetch (repo mode)
    emitLoadingProgress("Fetching pull requests...", {
      stage: "repo-prs",
      percentage: 10,
      completed: 0,
      total: 1,
    });
    const pullRequests: PullRequest[] = [];
    let page = 1;
    let hasMore = true;
    const MAX_PAGES = 5;

    try {
      while (hasMore && page <= MAX_PAGES) {
        const { data } = await octokit.request(
          "GET /repos/{owner}/{repo}/pulls",
          {
            owner: repoInfo.owner,
            repo: repoInfo.repo,
            state: "all",
            per_page: 100,
            page,
            sort: "created",
            direction: "desc",
            headers: {
              "X-GitHub-Api-Version": "2022-11-28",
            },
          },
        );

        if (data.length === 0) {
          hasMore = false;
          break;
        }

        const filteredPRs = data.filter((pr) =>
          isAfter(parseISO(pr.created_at), filterDate),
        );

        if (filteredPRs.length < data.length) {
          hasMore = false;
        }

        const mappedPRs = filteredPRs.map((pr) => ({
          number: pr.number,
          title: pr.title || `Pull Request #${pr.number}`,
          state: pr.state || "unknown",
          created_at: pr.created_at,
          merged_at: pr.merged_at || null,
          html_url: pr.html_url || "",
          repository_url: pr.base?.repo?.url || "",
          repository_name: `${repoInfo.owner}/${repoInfo.repo}`,
          user: {
            login: pr.user?.login || "unknown-user",
            avatar_url:
              pr.user?.avatar_url ||
              "https://github.com/identicons/placeholder.png",
            type: pr.user?.type,
          },
        }));

        pullRequests.push(...mappedPRs);
        page++;
        const pagePct = Math.min(85, 10 + Math.floor((page / MAX_PAGES) * 70));
        emitLoadingProgress(`Fetched page ${page - 1} of pull requests...`, {
          stage: "repo-prs",
          percentage: pagePct,
          completed: page - 1,
          total: MAX_PAGES,
        });
      }
    } catch (error) {
      console.error("Error fetching pull requests:", error);
    }

    emitLoadingProgress("Processing contributor data...", {
      stage: "processing",
      percentage: 92,
      completed: 1,
      total: 1,
    });
    const contributorMap = new Map<string, ContributorStats>();

    pullRequests.forEach((pr) => {
      const username = pr.user.login;
      const isMaintainer = maintainers.has(username);
      const isBot = pr.user.type === "Bot" || username.toLowerCase().includes("[bot]");

      const current = contributorMap.get(username) || {
        username,
        avatarUrl: pr.user.avatar_url,
        totalPRs: 0,
        mergedPRs: 0,
        openPRs: 0,
        closedPRs: 0,
        isMaintainer,
        isBot,
      };

      current.totalPRs++;
      if (pr.merged_at) {
        current.mergedPRs++;
      } else if (pr.state === "open") {
        current.openPRs++;
      } else {
        current.closedPRs++;
      }

      contributorMap.set(username, current);
    });

    const contributors = Array.from(contributorMap.values()).sort(
      (a, b) => b.totalPRs - a.totalPRs,
    );

    for (const contributor of contributors) {
      if (maintainers.has(contributor.username)) {
        console.log(`✅ ${contributor.username} IS a maintainer`);
      } else {
        console.log(`❌ ${contributor.username} is NOT a maintainer`);
      }
    }

    return {
      totalPRs: pullRequests.length,
      contributors,
      recentPRs: pullRequests,
    };
  });
};

export const fetchOrganizationActiveUsers = async (
  organization: string,
  timeFilter: TimeFilter,
): Promise<OrganizationActiveUsersResult> => {
  const normalizedOrg = organization.trim();
  if (!normalizedOrg) {
    throw new Error("Organization is required");
  }

  const cacheKey = `org_active_users_${normalizedOrg}_${timeFilter}`;
  return getCachedOrFetch(cacheKey, async () => {
    const octokit = createOctokit();
    const filterDate = getTimeFilterDate(timeFilter);

    emitLoadingProgress(`Fetching repositories for ${normalizedOrg}...`, {
      stage: "org-repos",
      percentage: 3,
      completed: 0,
      total: 1,
    });
    const firstPageRepos = await fetchOrgRepos(normalizedOrg, 1);

    const reposToScan = Array.from(new Set(firstPageRepos));
    const MAX_REPOS = 50;
    const selectedRepos = reposToScan.slice(0, MAX_REPOS);

    const MAX_PAGES_PER_REPO = 5;
    const pullRequests: PullRequest[] = [];

    const maintainersMap = new Map<string, Set<string>>();

    const fetchRepoPullRequests = async (
      repoName: string,
      repoIndex: number,
    ): Promise<PullRequest[]> => {
      try {
        const m = await getMaintainers(octokit, normalizedOrg, repoName, true);
        maintainersMap.set(repoName, m);
      } catch (err) {
        console.warn(`Could not fetch maintainers for ${normalizedOrg}/${repoName}`, err);
      }

      const repoPullRequests: PullRequest[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore && page <= MAX_PAGES_PER_REPO) {
        const totalUnits = Math.max(
          1,
          selectedRepos.length * MAX_PAGES_PER_REPO,
        );
        const currentUnit = repoIndex * MAX_PAGES_PER_REPO + page;
        const scanPct = Math.min(
          95,
          5 + Math.floor((currentUnit / totalUnits) * 85),
        );
        emitLoadingProgress(
          `Org scan ${repoIndex + 1}/${selectedRepos.length} • ${repoName} • page ${page}`,
          {
            stage: "org-scan",
            percentage: scanPct,
            completed: currentUnit,
            total: totalUnits,
          },
        );

        try {
          const { data } = await octokit.request(
            "GET /repos/{owner}/{repo}/pulls",
            {
              owner: normalizedOrg,
              repo: repoName,
              state: "all",
              per_page: 100,
              page,
              sort: "created",
              direction: "desc",
              headers: {
                "X-GitHub-Api-Version": "2022-11-28",
              },
            },
          );

          if (data.length === 0) {
            hasMore = false;
            break;
          }

          const filteredPRs = data.filter((pr) =>
            isAfter(parseISO(pr.created_at), filterDate),
          );

          if (filteredPRs.length < data.length) {
            hasMore = false;
          }

          const mappedPRs = filteredPRs.map((pr) => ({
            number: pr.number,
            title: pr.title || `Pull Request #${pr.number}`,
            state: pr.state || "unknown",
            created_at: pr.created_at,
            merged_at: pr.merged_at || null,
            html_url: pr.html_url || "",
            repository_url: pr.base?.repo?.url || "",
            repository_name: `${normalizedOrg}/${repoName}`,
            user: {
              login: pr.user?.login || "unknown-user",
              avatar_url:
                pr.user?.avatar_url ||
                "https://github.com/identicons/placeholder.png",
              type: pr.user?.type,
            },
          }));

          repoPullRequests.push(...mappedPRs);
          page++;
        } catch (error) {
          console.error(
            `Error fetching pull requests for ${normalizedOrg}/${repoName}:`,
            error,
          );
          hasMore = false;
        }
      }

      return repoPullRequests;
    };

    const CONCURRENT_REPO_FETCHES = 5;
    for (let i = 0; i < selectedRepos.length; i += CONCURRENT_REPO_FETCHES) {
      const batch = selectedRepos.slice(i, i + CONCURRENT_REPO_FETCHES);
      const batchResults = await Promise.all(
        batch.map((repoName, batchIndex) =>
          fetchRepoPullRequests(repoName, i + batchIndex),
        ),
      );
      for (const repoPRs of batchResults) {
        pullRequests.push(...repoPRs);
      }
    }

    emitLoadingProgress("Finalizing org activity results...", {
      stage: "finalizing",
      percentage: 98,
      completed: selectedRepos.length,
      total: selectedRepos.length,
    });

    const users = aggregateOrganizationActiveUsers(pullRequests, maintainersMap);

    emitLoadingProgress("Org scan completed", {
      stage: "completed",
      percentage: 100,
      completed: selectedRepos.length,
      total: selectedRepos.length,
    });

    return {
      organization: normalizedOrg,
      scannedRepos: selectedRepos.length,
      totalReposConsidered: reposToScan.length,
      users,
    };
  });
};

export interface LoadingProgressState {
  stage: string;
  message: string;
  percentage: number;
  completed: number;
  total: number;
}

// Create a utility to update loading progress
let setLoadingProgress: ((message: string) => void) | undefined;
let setStructuredLoadingProgress:
  | ((progress: LoadingProgressState) => void)
  | undefined;

const emitLoadingProgress = (
  message: string,
  structured?: Partial<LoadingProgressState>,
) => {
  setLoadingProgress?.(message);
  if (setStructuredLoadingProgress) {
    const percentage = Math.max(0, Math.min(100, structured?.percentage ?? 0));
    const completed = structured?.completed ?? 0;
    const total = structured?.total ?? 0;
    setStructuredLoadingProgress({
      stage: structured?.stage ?? "processing",
      message,
      percentage,
      completed,
      total,
    });
  }
};

export const registerLoadingHandler = (handler: (message: string) => void) => {
  setLoadingProgress = handler;
};

export const registerStructuredLoadingHandler = (
  handler: (progress: LoadingProgressState) => void,
) => {
  setStructuredLoadingProgress = handler;
};

export const fetchUserStats = async (
  username: string,
  timeFilter: TimeFilter,
): Promise<UserStats> => {
  const cacheKey = `user_${username}_${timeFilter}`;
  return getCachedOrFetch(cacheKey, async () => {
    // Use our new createOctokit function to get an authenticated instance
    const octokit = createOctokit();
    const filterDate = getTimeFilterDate(timeFilter);

    emitLoadingProgress(`Fetching user data for ${username}...`, {
      stage: "user",
      percentage: 5,
      completed: 0,
      total: 1,
    });
    const { data: userData } = await octokit.request("GET /users/{username}", {
      username,
      headers: {
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    const pullRequests: PullRequest[] = [];
    let page = 1;
    let hasMore = true;
    const MAX_PAGES = 3; // Limit to 300 PRs to improve performance

    // Fetch pull requests
    emitLoadingProgress(`Fetching ${username}'s pull requests...`, {
      stage: "user-prs",
      percentage: 10,
      completed: 0,
      total: MAX_PAGES,
    });
    try {
      while (hasMore && page <= MAX_PAGES) {
        const { data } = await octokit.request("GET /search/issues", {
          q: `author:${username} is:pr`,
          per_page: 100,
          page,
          sort: "created",
          order: "desc",
          headers: {
            "X-GitHub-Api-Version": "2022-11-28",
          },
        });

        if (!data.items || data.items.length === 0) {
          hasMore = false;
          break;
        }

        type SearchIssueItem = {
          number: number;
          title: string;
          state: string;
          created_at: string;
          html_url: string;
          repository_url: string;
          pull_request?: { merged_at?: string | null };
        };

        const filteredPRs = (data.items as SearchIssueItem[]).filter((pr) =>
          isAfter(parseISO(pr.created_at), filterDate),
        );

        if (filteredPRs.length < data.items.length) {
          hasMore = false;
        }

        pullRequests.push(
          ...filteredPRs.map((pr) => ({
            number: pr.number,
            title: pr.title,
            state: pr.state,
            created_at: pr.created_at,
            merged_at: pr.pull_request?.merged_at || null,
            html_url: pr.html_url,
            repository_url: pr.repository_url,
            repository_name: pr.repository_url.split("/repos/")[1],
            user: {
              login: username,
              avatar_url: userData.avatar_url,
            },
          })),
        );

        page++;
        const userPagePct = Math.min(
          85,
          10 + Math.floor((page / MAX_PAGES) * 70),
        );
        emitLoadingProgress(`Fetched page ${page - 1} of pull requests...`, {
          stage: "user-prs",
          percentage: userPagePct,
          completed: page - 1,
          total: MAX_PAGES,
        });
      }
    } catch (error) {
      console.error("Error fetching user pull requests:", error);
      // Continue with whatever we've fetched so far
    }

    emitLoadingProgress(`Processing repositories for ${username}...`, {
      stage: "user-processing",
      percentage: 90,
      completed: 1,
      total: 1,
    });
    const repositories: Record<
      string,
      {
        totalPRs: number;
        mergedPRs: number;
        openPRs: number;
        closedPRs: number;
      }
    > = {};
    const totalStats = {
      totalPRs: 0,
      mergedPRs: 0,
      openPRs: 0,
      closedPRs: 0,
    };

    // Process pull requests
    pullRequests.forEach((pr) => {
      const repoName = pr.repository_name!;
      if (!repositories[repoName]) {
        repositories[repoName] = {
          totalPRs: 0,
          mergedPRs: 0,
          openPRs: 0,
          closedPRs: 0,
        };
      }

      repositories[repoName].totalPRs++;
      totalStats.totalPRs++;

      if (pr.merged_at) {
        repositories[repoName].mergedPRs++;
        totalStats.mergedPRs++;
      } else if (pr.state === "open") {
        repositories[repoName].openPRs++;
        totalStats.openPRs++;
      } else {
        repositories[repoName].closedPRs++;
        totalStats.closedPRs++;
      }
    });

    // Only check maintainer status for repositories with the most contributions
    // to avoid excessive API calls
    let isMaintainer = false;
    const repoEntries = Object.entries(repositories)
      .sort(([, a], [, b]) => b.totalPRs - a.totalPRs)
      .slice(0, 3); // Top 3 repos

    emitLoadingProgress(`Checking maintainer status...`, {
      stage: "maintainer-check",
      percentage: 95,
      completed: 0,
      total: repoEntries.length || 1,
    });

    // Use Promise.all instead of Promise.any for better performance
    if (repoEntries.length > 0) {
      const checkResults = await Promise.all(
        repoEntries.map(async ([repoName]) => {
          try {
            const [owner, repo] = repoName.split("/");
            if (!owner || !repo) return false;

            const maintainers = await getMaintainers(octokit, owner, repo);
            const isMaintainerForRepo = maintainers.has(username);

            console.log(
              `${username} maintainer status for ${repoName}: ${isMaintainerForRepo}`,
            );
            return isMaintainerForRepo;
          } catch {
            return false;
          }
        }),
      );

      // If any check returns true, the user is a maintainer
      isMaintainer = checkResults.some(Boolean);
    }

    console.log(`Final maintainer status for ${username}: ${isMaintainer}`);

    emitLoadingProgress(`Completed user analysis for ${username}`, {
      stage: "completed",
      percentage: 100,
      completed: 1,
      total: 1,
    });

    return {
      username,
      avatarUrl: userData.avatar_url,
      repositories,
      pullRequests,
      totalStats,
      isMaintainer,
    };
  });
};

// Fetch organization repositories for autocomplete
export const fetchOrgRepos = async (
  org: string,
  page: number = 1,
): Promise<string[]> => {
  const octokit = createOctokit();

  try {
    const { data } = await octokit.request("GET /orgs/{org}/repos", {
      org,
      sort: "updated",
      direction: "desc",
      per_page: 20,
      page,
      headers: {
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    return data.map((repo: { name: string }) => repo.name);
  } catch (error) {
    console.error(`Error fetching repos for org ${org}:`, error);
    return [];
  }
};

// Fetch organization members for autocomplete
export const fetchOrgMembers = async (
  org: string,
  page: number = 1,
): Promise<Array<{ login: string; avatar_url: string }>> => {
  const octokit = createOctokit();

  try {
    const { data } = await octokit.request("GET /orgs/{org}/members", {
      org,
      per_page: 20,
      page,
      headers: {
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    return data.map((member: { login: string; avatar_url: string }) => ({
      login: member.login,
      avatar_url: member.avatar_url,
    }));
  } catch (error) {
    console.error(`Error fetching members for org ${org}:`, error);
    return [];
  }
};
