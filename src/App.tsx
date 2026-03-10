import { useState, useEffect, useRef, useCallback } from "react";
import {
  Github,
  GitPullRequest,
  GitPullRequestClosed,
  GitMerge,
  Loader2,
  Users,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  KeyRound,
  AlertCircle,
  X,
  Check,
  Cpu,
  Database,
  FolderGit,
  Activity,
} from "lucide-react";
import {
  fetchRepoStats,
  fetchUserStats,
  registerLoadingHandler,
  registerStructuredLoadingHandler,
  LoadingProgressState,
  fetchOrgRepos,
  fetchOrgMembers,
  fetchOrganizationActiveUsers,
} from "./utils/github";
import type {
  RepoStats,
  UserStats,
  TimeFilter,
  OrganizationActiveUserStats,
} from "./types";
import { UserStatsModal } from "./components/UserStatsModal";
import { TokenSettings } from "./components/TokenSettings";
import { hasGitHubToken } from "./utils/env";
import { ThemeProvider } from "./contexts/ThemeContext";

function AppContent() {
  const [repoUrl, setRepoUrl] = useState("");
  const [stats, setStats] = useState<RepoStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("1m");
  const [selectedUser, setSelectedUser] = useState<UserStats | null>(null);
  const [loadingUser, setLoadingUser] = useState(false);
  const [showPRs, setShowPRs] = useState(false);
  const [prFilter, setPrFilter] = useState<
    "all" | "open" | "merged" | "closed"
  >("all");
  const [loadingProgress, setLoadingProgress] = useState("");
  const [structuredProgress, setStructuredProgress] =
    useState<LoadingProgressState | null>(null);
  const [showTokenSettings, setShowTokenSettings] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [showTokenNotification, setShowTokenNotification] = useState(false);
  const [collaboratorsOnly, setCollaboratorsOnly] = useState(false);

  // Search mode: 'repo' | 'member' | 'org'
  const [searchMode, setSearchMode] = useState<"repo" | "member" | "org">(
    "repo",
  );

  // Autocomplete state
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [memberSuggestions, setMemberSuggestions] = useState<
    Array<{ login: string; avatar_url: string }>
  >([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [suggestionsPage, setSuggestionsPage] = useState(1);
  const [suggestionsOrg, setSuggestionsOrg] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Org avatar loading state
  const [orgAvatarLoaded, setOrgAvatarLoaded] = useState(false);
  const [currentOrg, setCurrentOrg] = useState<string>("");

  // Track org changes from repoUrl
  useEffect(() => {
    const org = repoUrl.includes("/") ? repoUrl.split("/")[0] : "";
    if (org !== currentOrg) {
      setCurrentOrg(org);
      setOrgAvatarLoaded(false);
    }
  }, [repoUrl, currentOrg]);

  useEffect(() => {
    registerLoadingHandler(setLoadingProgress);
    registerStructuredLoadingHandler(setStructuredProgress);
    const hasExistingToken = hasGitHubToken();
    setHasToken(hasExistingToken);
    const hasSeenNotification = localStorage.getItem("token_notification_seen");
    if (!hasExistingToken && !hasSeenNotification) {
      setShowTokenNotification(true);
    }
  }, []);

  useEffect(() => {
    const checkTokenOnFocus = () => {
      const tokenExists = hasGitHubToken();
      setHasToken(tokenExists);
    };
    window.addEventListener("focus", checkTokenOnFocus);
    return () => window.removeEventListener("focus", checkTokenOnFocus);
  }, []);

  // Fetch suggestions when org/ pattern is detected
  useEffect(() => {
    const fetchSuggestions = async () => {
      const trimmed = repoUrl.trim();

      // Check if pattern matches "org/" or "org/something"
      const match = trimmed.match(/^([a-zA-Z0-9_-]+)\/(.*)$/);
      if (match && !trimmed.includes("github.com")) {
        const org = match[1];
        const queryPart = match[2];

        // Reset pagination if org changed
        if (org !== suggestionsOrg) {
          setSuggestionsOrg(org);
          setSuggestionsPage(1);
          setSuggestions([]);
          setMemberSuggestions([]);
        }

        // Only fetch if we have an org and query is reasonable length
        if (org && (queryPart === "" || queryPart.length < 30)) {
          setIsFetchingSuggestions(true);
          try {
            if (searchMode === "repo") {
              const repos = await fetchOrgRepos(org, 1);
              // Filter repos based on what's already typed
              const filtered = queryPart
                ? repos.filter((r) =>
                  r.toLowerCase().startsWith(queryPart.toLowerCase()),
                )
                : repos;
              setSuggestions(filtered);
              setShowSuggestions(filtered.length > 0);
            } else {
              // Member mode
              const members = await fetchOrgMembers(org, 1);
              // Filter members based on what's already typed
              const filtered = queryPart
                ? members.filter((m) =>
                  m.login.toLowerCase().startsWith(queryPart.toLowerCase()),
                )
                : members;
              setMemberSuggestions(filtered);
              setShowSuggestions(filtered.length > 0);
            }
            setSelectedIndex(0);
          } catch {
            setSuggestions([]);
            setMemberSuggestions([]);
            setShowSuggestions(false);
          } finally {
            setIsFetchingSuggestions(false);
          }
        } else {
          setShowSuggestions(false);
        }
      } else {
        setShowSuggestions(false);
        setSuggestionsOrg("");
        setSuggestionsPage(1);
      }
    };

    // Debounce the fetch
    const timeoutId = setTimeout(fetchSuggestions, 150);
    return () => clearTimeout(timeoutId);
  }, [repoUrl, suggestionsOrg, searchMode]);

  // Scroll selected item into view
  const scrollSelectedIntoView = useCallback((index: number) => {
    if (suggestionsRef.current) {
      const selectedElement = suggestionsRef.current.children[
        index + 1
      ] as HTMLElement; // +1 for header
      if (selectedElement) {
        selectedElement.scrollIntoView({
          block: "nearest",
          behavior: "smooth",
        });
      }
    }
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      const currentSuggestions =
        searchMode === "repo"
          ? suggestions
          : memberSuggestions.map((m) => m.login);

      // Shift+Tab toggles mode when not showing suggestions
      if (e.key === "Tab" && !showSuggestions) {
        e.preventDefault();
        setSearchMode((prev) => {
          if (e.shiftKey) {
            return prev === "repo" ? "org" : prev === "org" ? "member" : "repo";
          }
          return prev === "repo"
            ? "member"
            : prev === "member"
              ? "org"
              : "repo";
        });
        setRepoUrl("");
        setOrgAvatarLoaded(false);
        setCurrentOrg("");
        return;
      }

      if (!showSuggestions || currentSuggestions.length === 0) return;

      switch (e.key) {
        case "Tab":
          e.preventDefault();
          // If only one result, Tab acts as Enter
          if (currentSuggestions.length === 1) {
            const match = repoUrl.match(/^([a-zA-Z0-9_-]+)\/(.*)$/);
            if (match) {
              setRepoUrl(`${match[1]}/${currentSuggestions[0]}`);
              setShowSuggestions(false);
            }
          } else if (e.shiftKey) {
            // Shift+Tab: move up
            const newIndex =
              selectedIndex === 0
                ? currentSuggestions.length - 1
                : selectedIndex - 1;
            setSelectedIndex(newIndex);
            scrollSelectedIntoView(newIndex);
          } else {
            // Tab: move down
            const newIndex = (selectedIndex + 1) % currentSuggestions.length;
            setSelectedIndex(newIndex);
            scrollSelectedIntoView(newIndex);
          }
          break;
        case "Enter":
          e.preventDefault();
          if (currentSuggestions[selectedIndex]) {
            const match = repoUrl.match(/^([a-zA-Z0-9_-]+)\/(.*)$/);
            if (match) {
              setRepoUrl(`${match[1]}/${currentSuggestions[selectedIndex]}`);
              setShowSuggestions(false);
            }
          }
          break;
        case "ArrowDown":
          e.preventDefault();
          {
            const newIndex = (selectedIndex + 1) % currentSuggestions.length;
            setSelectedIndex(newIndex);
            scrollSelectedIntoView(newIndex);
          }
          break;
        case "ArrowUp":
          e.preventDefault();
          {
            const newIndex =
              selectedIndex === 0
                ? currentSuggestions.length - 1
                : selectedIndex - 1;
            setSelectedIndex(newIndex);
            scrollSelectedIntoView(newIndex);
          }
          break;
        case "Escape":
          setShowSuggestions(false);
          break;
      }
    },
    [
      showSuggestions,
      suggestions,
      memberSuggestions,
      selectedIndex,
      repoUrl,
      scrollSelectedIntoView,
      searchMode,
    ],
  );

  // Handle suggestion click
  const handleSuggestionClick = (value: string) => {
    const match = repoUrl.match(/^([a-zA-Z0-9_-]+)\/(.*)$/);
    if (match) {
      setRepoUrl(`${match[1]}/${value}`);
      setShowSuggestions(false);
      inputRef.current?.focus();
    }
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle scroll for lazy loading more items
  const handleScroll = useCallback(async () => {
    if (!suggestionsRef.current || isLoadingMore || isFetchingSuggestions)
      return;

    const { scrollTop, scrollHeight, clientHeight } = suggestionsRef.current;
    const scrollPercent = (scrollTop + clientHeight) / scrollHeight;

    // Load more when within 20% of bottom
    if (scrollPercent > 0.8 && suggestionsOrg) {
      setIsLoadingMore(true);
      try {
        const nextPage = suggestionsPage + 1;

        if (searchMode === "repo") {
          const newRepos = await fetchOrgRepos(suggestionsOrg, nextPage);
          if (newRepos.length > 0) {
            setSuggestions((prev) => [...prev, ...newRepos]);
            setSuggestionsPage(nextPage);
          }
        } else {
          const newMembers = await fetchOrgMembers(suggestionsOrg, nextPage);
          if (newMembers.length > 0) {
            setMemberSuggestions((prev) => [...prev, ...newMembers]);
            setSuggestionsPage(nextPage);
          }
        }
      } catch (err) {
        console.error("Error loading more items:", err);
      } finally {
        setIsLoadingMore(false);
      }
    }
  }, [
    isLoadingMore,
    isFetchingSuggestions,
    suggestionsOrg,
    suggestionsPage,
    searchMode,
  ]);

  // Attach scroll listener
  useEffect(() => {
    const dropdown = suggestionsRef.current;
    if (dropdown) {
      dropdown.addEventListener("scroll", handleScroll);
      return () => dropdown.removeEventListener("scroll", handleScroll);
    }
  }, [handleScroll]);

  const normalizeRepoUrl = (url: string): string => {
    const trimmed = url.trim();
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      return trimmed;
    }
    if (trimmed.startsWith("github.com/")) {
      return `https://${trimmed}`;
    }
    if (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(trimmed)) {
      return `https://github.com/${trimmed}`;
    }
    return trimmed;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowSuggestions(false);

    if (searchMode === "member") {
      // In member mode, extract username and show user stats
      const match = repoUrl.match(/^([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)$/);
      if (match) {
        const username = match[2];
        await handleUserClick(username);
      } else {
        setError("Please enter in format: org/username");
      }
      return;
    }

    setLoading(true);
    setError(null);
    setStats(null);
    setShowPRs(false);
    setStructuredProgress(null);

    try {
      if (searchMode === "org") {
        setLoadingProgress("Starting organization-wide scan...");
        const orgInput = repoUrl.includes("/")
          ? repoUrl.split("/")[0]
          : repoUrl;
        const orgResult = await fetchOrganizationActiveUsers(
          orgInput,
          timeFilter,
        );

        setStats({
          totalPRs: 0,
          contributors: [],
          recentPRs: [],
          organizationActiveUsers: orgResult.users,
          orgAnalysisResult: orgResult,
        });
      } else {
        setLoadingProgress("Fetching repository data...");
        const normalizedUrl = normalizeRepoUrl(repoUrl);
        const data = await fetchRepoStats(normalizedUrl, timeFilter);
        setStats(data);
      }
      setLoadingProgress("");
      setStructuredProgress(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : searchMode === "org"
            ? "Failed to fetch organization activity"
            : "Failed to fetch repository statistics",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleUserClick = async (username: string) => {
    setLoadingUser(true);
    setStructuredProgress(null);
    setLoadingProgress(`Loading details for ${username}...`);
    try {
      const userStats = await fetchUserStats(username, timeFilter);
      setSelectedUser(userStats);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch user statistics",
      );
    } finally {
      setLoadingUser(false);
      setLoadingProgress("");
      setStructuredProgress(null);
    }
  };

  const togglePRs = () => setShowPRs(!showPRs);

  const dismissTokenNotification = () => {
    setShowTokenNotification(false);
    localStorage.setItem("token_notification_seen", "true");
  };

  const openTokenSettings = () => {
    setShowTokenSettings(true);
    setShowTokenNotification(false);
    localStorage.setItem("token_notification_seen", "true");
  };

  const getStatusIcon = () => {
    if (loading)
      return (
        <Loader2
          className="w-4 h-4 animate-spin"
          style={{ color: "var(--primary)" }}
        />
      );
    if (stats)
      return (
        <Check className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
      );
    return (
      <Database className="w-4 h-4" style={{ color: "var(--text-dim)" }} />
    );
  };

  return (
    <div className="min-h-screen terminal-container flex flex-col">
      {/* Token Notification */}
      {showTokenNotification && (
        <div className="fixed bottom-4 right-4 max-w-md z-50 animate-fade-in">
          <div
            className="p-4 rounded-lg"
            style={{
              background: "var(--bg-secondary)",
              border: "1px solid var(--border)",
            }}
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <AlertCircle
                  className="w-5 h-5"
                  style={{ color: "var(--text-muted)" }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <h3
                  className="text-sm font-medium"
                  style={{ color: "var(--text)" }}
                >
                  API Rate Limits
                </h3>
                <p
                  className="mt-1 text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  Add GitHub PAT to raise API limit from 60 to 5,000
                  requests/hour
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={openTokenSettings}
                    className="terminal-button-primary text-xs"
                  >
                    Add Token
                  </button>
                  <button
                    onClick={dismissTokenNotification}
                    className="terminal-button-secondary text-xs"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
              <button
                onClick={dismissTokenNotification}
                className="flex-shrink-0"
                style={{ color: "var(--text-dim)" }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header
        style={{
          background: "var(--bg-secondary)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <span
              className="font-bold text-lg"
              style={{ color: "var(--text)" }}
            >
              Gitivity
            </span>
            <span
              className="text-xs px-2 py-0.5 rounded"
              style={{
                color: "var(--text-dim)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              v1.0.0
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTokenSettings(true)}
              className="terminal-button-secondary flex items-center gap-1.5 text-xs"
              style={{
                borderColor: hasToken ? "var(--text-muted)" : "var(--border)",
              }}
            >
              {hasToken ? (
                <>
                  <Check
                    className="w-3.5 h-3.5"
                    style={{ color: "var(--text-muted)" }}
                  />
                  <span className="hidden sm:inline">Token OK</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Add Token</span>
                </>
              )}
            </button>

            <a
              href="https://github.com/vee1e/Gitivity"
              target="_blank"
              rel="noopener noreferrer"
              className="terminal-button-primary flex items-center gap-1.5 text-xs"
            >
              <Github className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">GitHub</span>
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 flex-1 w-full">
        {/* Input Form */}
        <div
          className="p-4 mb-6 rounded-lg"
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
          }}
        >
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-6 relative">
                <div className="flex items-center gap-2 mb-1.5">
                  {/* Mode Toggle - on left */}
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setSearchMode("repo");
                        setRepoUrl("");
                        setShowSuggestions(false);
                        setOrgAvatarLoaded(false);
                        setCurrentOrg("");
                      }}
                      className="text-[10px] px-2 py-0.5 rounded-l transition-all"
                      style={{
                        background:
                          searchMode === "repo"
                            ? "var(--primary)"
                            : "var(--bg-tertiary)",
                        border: "1px solid var(--border)",
                        borderRight: "none",
                        color:
                          searchMode === "repo"
                            ? "var(--bg)"
                            : "var(--text-dim)",
                        fontWeight: searchMode === "repo" ? 500 : 400,
                      }}
                    >
                      Repo
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchMode("member");
                        setRepoUrl("");
                        setShowSuggestions(false);
                        setOrgAvatarLoaded(false);
                        setCurrentOrg("");
                      }}
                      className="text-[10px] px-2 py-0.5 transition-all"
                      style={{
                        background:
                          searchMode === "member"
                            ? "var(--primary)"
                            : "var(--bg-tertiary)",
                        borderTop: "1px solid var(--border)",
                        borderBottom: "1px solid var(--border)",
                        borderLeft: "none",
                        borderRight: "none",
                        color:
                          searchMode === "member"
                            ? "var(--bg)"
                            : "var(--text-dim)",
                        fontWeight: searchMode === "member" ? 500 : 400,
                      }}
                    >
                      Member
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchMode("org");
                        setRepoUrl("");
                        setShowSuggestions(false);
                        setOrgAvatarLoaded(false);
                        setCurrentOrg("");
                      }}
                      className="text-[10px] px-2 py-0.5 rounded-r transition-all"
                      style={{
                        background:
                          searchMode === "org"
                            ? "var(--primary)"
                            : "var(--bg-tertiary)",
                        border: "1px solid var(--border)",
                        color:
                          searchMode === "org"
                            ? "var(--bg)"
                            : "var(--text-dim)",
                        fontWeight: searchMode === "org" ? 500 : 400,
                      }}
                    >
                      Org
                    </button>
                  </div>
                  <label
                    className="text-xs"
                    style={{ color: "var(--text-dim)" }}
                  >
                    {searchMode === "repo"
                      ? "REPOSITORY"
                      : searchMode === "member"
                        ? "ORGANIZATION MEMBER"
                        : "ORGANIZATION"}
                  </label>
                </div>
                <div className="terminal-input-line">
                  <span className="terminal-prompt">$</span>
                  <div
                    className="overflow-hidden transition-all duration-200 ease-out flex items-center"
                    style={{
                      width: currentOrg && orgAvatarLoaded ? "28px" : "0px",
                      opacity: currentOrg && orgAvatarLoaded ? 1 : 0,
                    }}
                  >
                    {currentOrg && (
                      <img
                        src={`https://github.com/${currentOrg}.png?size=48`}
                        alt=""
                        className="w-6 h-6 rounded flex-shrink-0"
                        style={{ border: "1px solid var(--border-subtle)" }}
                        onLoad={() => setOrgAvatarLoaded(true)}
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    )}
                  </div>
                  <input
                    ref={inputRef}
                    type="text"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      searchMode === "repo"
                        ? "org/repo (e.g., facebook/react)"
                        : searchMode === "member"
                          ? "org/username (e.g., facebook/zuck)"
                          : "organization (e.g., facebook)"
                    }
                    className="terminal-input rounded-md"
                    required
                    autoComplete="off"
                  />
                </div>

                {/* Autocomplete Dropdown */}
                {showSuggestions && (
                  <div
                    ref={suggestionsRef}
                    className="absolute left-0 right-0 mt-1 z-50 rounded-md overflow-hidden"
                    style={{
                      background: "var(--bg-tertiary)",
                      border: "1px solid var(--border)",
                      maxHeight: "300px",
                      overflowY: "auto",
                    }}
                  >
                    {isFetchingSuggestions &&
                      (searchMode === "repo"
                        ? suggestions.length === 0
                        : memberSuggestions.length === 0) ? (
                      <div
                        className="p-3 text-xs flex items-center gap-2"
                        style={{ color: "var(--text-muted)" }}
                      >
                        <Loader2 className="w-3 h-3 animate-spin" />
                        {searchMode === "repo"
                          ? "Loading repositories..."
                          : "Loading members..."}
                      </div>
                    ) : (
                      <>
                        <div
                          className="px-3 py-1.5 text-[10px] uppercase flex items-center justify-between sticky top-0 z-10"
                          style={{
                            color: "var(--text-dim)",
                            borderBottom: "1px solid var(--border-subtle)",
                            background: "var(--bg-tertiary)",
                          }}
                        >
                          <span>Tab ↓ Shift+Tab ↑ Enter to select</span>
                          <span style={{ color: "var(--text-dim)" }}>
                            {searchMode === "repo"
                              ? `${suggestions.length} repos`
                              : `${memberSuggestions.length} members`}
                          </span>
                        </div>
                        <div>
                          {searchMode === "repo"
                            ? // Repo suggestions
                            suggestions.map((repo, index) => (
                              <button
                                key={repo}
                                type="button"
                                onClick={() => handleSuggestionClick(repo)}
                                className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 rounded-md"
                                style={{
                                  background:
                                    index === selectedIndex
                                      ? "var(--bg-secondary)"
                                      : "transparent",
                                  color:
                                    index === selectedIndex
                                      ? "var(--text)"
                                      : "var(--text-muted)",
                                  borderLeft:
                                    index === selectedIndex
                                      ? "2px solid var(--primary)"
                                      : "2px solid transparent",
                                }}
                                onMouseEnter={() => setSelectedIndex(index)}
                              >
                                <FolderGit className="w-3.5 h-3.5" />
                                {repo}
                              </button>
                            ))
                            : // Member suggestions
                            memberSuggestions.map((member, index) => (
                              <button
                                key={member.login}
                                type="button"
                                onClick={() =>
                                  handleSuggestionClick(member.login)
                                }
                                className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 rounded-md"
                                style={{
                                  background:
                                    index === selectedIndex
                                      ? "var(--bg-secondary)"
                                      : "transparent",
                                  color:
                                    index === selectedIndex
                                      ? "var(--text)"
                                      : "var(--text-muted)",
                                  borderLeft:
                                    index === selectedIndex
                                      ? "2px solid var(--primary)"
                                      : "2px solid transparent",
                                }}
                                onMouseEnter={() => setSelectedIndex(index)}
                              >
                                <img
                                  src={member.avatar_url}
                                  alt={member.login}
                                  className="w-5 h-5 rounded-full"
                                  style={{
                                    border: "1px solid var(--border-subtle)",
                                  }}
                                />
                                {member.login}
                              </button>
                            ))}
                        </div>
                        {(isFetchingSuggestions || isLoadingMore) && (
                          <div
                            className="px-3 py-2 text-xs flex items-center justify-center gap-2 sticky bottom-0"
                            style={{
                              color: "var(--text-dim)",
                              background: "var(--bg-tertiary)",
                              borderTop: "1px solid var(--border-subtle)",
                            }}
                          >
                            <Loader2 className="w-3 h-3 animate-spin" />
                            {isLoadingMore
                              ? `Loading more... (${searchMode === "repo" ? suggestions.length : memberSuggestions.length} loaded)`
                              : "Loading..."}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="md:col-span-3">
                <label
                  className="block text-xs mb-1.5"
                  style={{ color: "var(--text-dim)" }}
                >
                  TIME PERIOD
                </label>
                <div className="relative">
                  <select
                    value={timeFilter}
                    onChange={(e) =>
                      setTimeFilter(e.target.value as TimeFilter)
                    }
                    className="w-full terminal-input rounded-md"
                    style={{ appearance: "none", paddingRight: "32px" }}
                  >
                    <option value="2w">2 Weeks</option>
                    <option value="1m">1 Month</option>
                    <option value="3m">3 Months</option>
                    <option value="6m">6 Months</option>
                    <option value="all">All Time</option>
                  </select>
                  <ChevronDown
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                    style={{ color: "var(--text-muted)" }}
                  />
                </div>
              </div>

              <div className="md:col-span-3 flex items-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="terminal-button-primary w-full flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <span>Analyze</span>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Status Bar */}
        <div
          className="mb-6 flex items-center gap-4 text-xs"
          style={{ color: "var(--text-dim)" }}
        >
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4" />
            <span>
              {loading ? "PROCESSING" : stats ? "COMPLETED" : "READY"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <span>
              {loadingProgress ||
                (stats
                  ? `Found ${stats.contributors.length} contributors`
                  : "Waiting for input")}
            </span>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div
            className="p-4 mb-6 rounded-lg"
            style={{
              background: "var(--bg-secondary)",
              border: "1px solid var(--text-dim)",
            }}
          >
            <div className="flex items-center gap-3">
              <X className="w-5 h-5" style={{ color: "var(--text-muted)" }} />
              <div>
                <p
                  className="text-sm font-medium"
                  style={{ color: "var(--text)" }}
                >
                  Error
                </p>
                <p
                  className="text-xs mt-1"
                  style={{ color: "var(--text-muted)" }}
                >
                  {error}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && !stats && (
          <div
            className="p-4 mb-6 rounded-lg"
            style={{
              background: "var(--bg-secondary)",
              border: "1px solid var(--border)",
            }}
          >
            <div className="flex items-center justify-center py-12">
              <div className="text-center max-w-md w-full px-4">
                <Loader2
                  className="w-8 h-8 animate-spin mx-auto mb-4"
                  style={{ color: "var(--text-muted)" }}
                />
                <p
                  className="text-sm font-medium mb-3"
                  style={{ color: "var(--text)" }}
                >
                  {loadingProgress}
                </p>

                {structuredProgress && (
                  <div className="w-full">
                    <div className="flex justify-between text-[10px] mb-1.5">
                      <span
                        className="uppercase"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {structuredProgress.stage}
                      </span>
                      <span style={{ color: "var(--text-dim)" }}>
                        {structuredProgress.percentage}%
                      </span>
                    </div>
                    <div
                      className="w-full h-1.5 rounded-full overflow-hidden"
                      style={{ background: "var(--bg-tertiary)" }}
                    >
                      <div
                        className="h-full rounded-full transition-all duration-300 ease-out"
                        style={{
                          background: "var(--primary)",
                          width: `${structuredProgress.percentage}%`,
                        }}
                      />
                    </div>
                    {structuredProgress.total > 1 && (
                      <div
                        className="text-[10px] mt-1.5 text-right"
                        style={{ color: "var(--text-dim)" }}
                      >
                        {structuredProgress.completed} /{" "}
                        {structuredProgress.total} units
                      </div>
                    )}
                  </div>
                )}

                {!structuredProgress && (
                  <p
                    className="text-xs mt-1"
                    style={{ color: "var(--text-dim)" }}
                  >
                    This may take a moment for large repositories
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* User Loading Modal */}
        {loadingUser && (
          <div
            className="fixed inset-0 flex items-center justify-center z-50"
            style={{ background: "rgba(0,0,0,0.8)" }}
          >
            <div
              className="p-6 rounded-lg"
              style={{
                background: "var(--bg-secondary)",
                border: "1px solid var(--border)",
              }}
            >
              <div className="flex items-center gap-3">
                <Loader2
                  className="w-5 h-5 animate-spin"
                  style={{ color: "var(--text-muted)" }}
                />
                <p style={{ color: "var(--text)" }}>
                  Loading user statistics...
                </p>
              </div>
            </div>
          </div>
        )}

        {/* User Stats Modal */}
        {selectedUser && (
          <UserStatsModal
            stats={selectedUser}
            onClose={() => setSelectedUser(null)}
          />
        )}

        {/* Stats Display */}
        {stats && (
          <div className="space-y-6">
            {/* Contributors Section */}
            {searchMode !== "org" && stats.contributors && stats.contributors.length > 0 && (
              <div
                className="rounded-lg overflow-hidden"
                style={{
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border)",
                }}
              >
                <div
                  className="p-3 flex items-center gap-3"
                  style={{
                    background: "var(--bg-tertiary)",
                    borderBottom: "1px solid var(--border-subtle)",
                  }}
                >
                  <Users
                    className="w-4 h-4"
                    style={{ color: "var(--text-muted)" }}
                  />
                  <span
                    className="text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Contributors
                  </span>
                  <div className="flex-1" />
                  <span
                    className="text-xs px-2 py-0.5 rounded"
                    style={{
                      color: "var(--text-dim)",
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    {stats.contributors.filter(c => !collaboratorsOnly || (!c.isMaintainer && !c.isBot)).length} total
                  </span>
                  <label className="flex items-center gap-1.5 cursor-pointer ml-2">
                    <input
                      type="checkbox"
                      checked={collaboratorsOnly}
                      onChange={(e) => setCollaboratorsOnly(e.target.checked)}
                      className="w-3.5 h-3.5 rounded"
                      style={{ accentColor: "var(--primary)" }}
                    />
                    <span className="text-xs" style={{ color: "var(--text-dim)" }}>Collaborators Only</span>
                  </label>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {stats.contributors
                      .filter(c => !collaboratorsOnly || (!c.isMaintainer && !c.isBot))
                      .map((contributor) => (
                        <button
                          key={contributor.username}
                          onClick={() => handleUserClick(contributor.username)}
                          className="text-left p-3 rounded-md"
                          style={{
                            background: "var(--bg-tertiary)",
                            border: "1px solid var(--border-subtle)",
                          }}
                        >
                          <div className="flex items-start gap-3">
                            <img
                              src={contributor.avatarUrl}
                              alt={contributor.username}
                              className="w-10 h-10 rounded-lg"
                              style={{ border: "1px solid var(--border-subtle)" }}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  className="text-sm font-medium truncate"
                                  style={{ color: "var(--text)" }}
                                >
                                  {contributor.username}
                                </span>
                                {contributor.isMaintainer ? (
                                  <span
                                    className="text-[10px] px-1.5 py-0.5 rounded"
                                    style={{
                                      border: "1px solid var(--text-muted)",
                                      color: "var(--text-muted)",
                                    }}
                                  >
                                    Maint
                                  </span>
                                ) : (
                                  <span
                                    className="text-[10px] px-1.5 py-0.5 rounded"
                                    style={{
                                      border: "1px solid var(--text-dim)",
                                      color: "var(--text-dim)",
                                    }}
                                  >
                                    Contr
                                  </span>
                                )}
                              </div>

                              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                                <div
                                  className="flex items-center gap-1.5"
                                  style={{ color: "var(--text-muted)" }}
                                >
                                  <GitPullRequest className="w-3 h-3" />
                                  <span>{contributor.totalPRs} PRs</span>
                                </div>
                                <div
                                  className="flex items-center gap-1.5"
                                  style={{ color: "var(--text-muted)" }}
                                >
                                  <GitMerge
                                    className="w-3 h-3"
                                    style={{ color: "var(--pr-merged)" }}
                                  />
                                  <span>{contributor.mergedPRs} merged</span>
                                </div>
                                <div
                                  className="flex items-center gap-1.5"
                                  style={{ color: "var(--text-muted)" }}
                                >
                                  <GitPullRequest
                                    className="w-3 h-3"
                                    style={{ color: "var(--pr-open)" }}
                                  />
                                  <span>{contributor.openPRs} open</span>
                                </div>
                                <div
                                  className="flex items-center gap-1.5"
                                  style={{ color: "var(--text-muted)" }}
                                >
                                  <GitPullRequestClosed
                                    className="w-3 h-3"
                                    style={{ color: "var(--pr-closed)" }}
                                  />
                                  <span>{contributor.closedPRs} closed</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                  </div>
                </div>
              </div>
            )}

            {/* Organization Most Active Users Section */}
            {stats.organizationActiveUsers &&
              stats.organizationActiveUsers.length > 0 && (
                <div
                  className="rounded-lg overflow-hidden"
                  style={{
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div
                    className="p-3 flex items-center gap-3"
                    style={{
                      background: "var(--bg-tertiary)",
                      borderBottom: "1px solid var(--border-subtle)",
                    }}
                  >
                    <Activity
                      className="w-4 h-4"
                      style={{ color: "var(--text-muted)" }}
                    />
                    <span
                      className="text-xs"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Most Active Users (Org-wide across repos)
                    </span>
                    <div className="flex-1" />
                    {stats.orgAnalysisResult && (
                      <span
                        className="text-xs px-2 py-0.5 rounded"
                        style={{
                          color: "var(--text-dim)",
                          border: "1px solid var(--border-subtle)",
                        }}
                      >
                        scanned {stats.orgAnalysisResult.scannedRepos}/
                        {stats.orgAnalysisResult.totalReposConsidered} repos
                      </span>
                    )}
                    <span
                      className="text-xs px-2 py-0.5 rounded"
                      style={{
                        color: "var(--text-dim)",
                        border: "1px solid var(--border-subtle)",
                      }}
                    >
                      {stats.organizationActiveUsers.filter(u => !collaboratorsOnly || (!u.isMaintainer && !u.isBot)).length} users
                    </span>
                    <label className="flex items-center gap-1.5 cursor-pointer ml-2">
                      <input
                        type="checkbox"
                        checked={collaboratorsOnly}
                        onChange={(e) => setCollaboratorsOnly(e.target.checked)}
                        className="w-3.5 h-3.5 rounded"
                        style={{ accentColor: "var(--primary)" }}
                      />
                      <span className="text-xs" style={{ color: "var(--text-dim)" }}>Collaborators Only</span>
                    </label>
                  </div>
                  <div className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                      {stats.organizationActiveUsers
                        .filter(u => !collaboratorsOnly || (!u.isMaintainer && !u.isBot))
                        .map(
                          (user: OrganizationActiveUserStats) => (
                            <button
                              key={user.username}
                              onClick={() => handleUserClick(user.username)}
                              className="text-left p-3 rounded-md"
                              style={{
                                background: "var(--bg-tertiary)",
                                border: "1px solid var(--border-subtle)",
                              }}
                            >
                              <div className="flex items-start gap-3">
                                <img
                                  src={user.avatarUrl}
                                  alt={user.username}
                                  className="w-10 h-10 rounded-lg"
                                  style={{
                                    border: "1px solid var(--border-subtle)",
                                  }}
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <span
                                      className="text-sm font-medium truncate"
                                      style={{ color: "var(--text)" }}
                                    >
                                      {user.username}
                                    </span>
                                    <span
                                      className="text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap"
                                      style={{
                                        border: "1px solid var(--border-subtle)",
                                        color: "var(--text-dim)",
                                      }}
                                    >
                                      {user.repositoriesContributed} repos
                                    </span>
                                  </div>

                                  <div
                                    className="mt-2 grid grid-cols-2 gap-2 text-xs"
                                    style={{ color: "var(--text-muted)" }}
                                  >
                                    <div className="flex items-center gap-1.5">
                                      <GitPullRequest className="w-3 h-3" />
                                      <span>{user.totalPRs} PRs</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <GitMerge
                                        className="w-3 h-3"
                                        style={{ color: "var(--pr-merged)" }}
                                      />
                                      <span>{user.mergedPRs} merged</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <GitPullRequest
                                        className="w-3 h-3"
                                        style={{ color: "var(--pr-open)" }}
                                      />
                                      <span>{user.openPRs} open</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <GitPullRequestClosed
                                        className="w-3 h-3"
                                        style={{ color: "var(--pr-closed)" }}
                                      />
                                      <span>{user.closedPRs} closed</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </button>
                          ),
                        )}
                    </div>
                  </div>
                </div>
              )}

            {/* Pull Requests Section */}
            <div
              className="rounded-lg overflow-hidden"
              style={{
                background: "var(--bg-secondary)",
                border: "1px solid var(--border)",
              }}
            >
              <div
                className="p-3 flex items-center gap-3 cursor-pointer"
                style={{
                  background: "var(--bg-tertiary)",
                  borderBottom: showPRs
                    ? "1px solid var(--border-subtle)"
                    : "none",
                }}
                onClick={togglePRs}
              >
                <GitPullRequest
                  className="w-4 h-4"
                  style={{ color: "var(--text-muted)" }}
                />
                <span
                  className="text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  Pull Requests
                </span>
                <div className="flex-1" />
                <span
                  className="text-xs px-2 py-0.5 rounded"
                  style={{
                    color: "var(--text-dim)",
                    border: "1px solid var(--border-subtle)",
                  }}
                >
                  {stats.totalPRs} total
                </span>
                <button
                  className="ml-2 p-1 hover:opacity-80"
                  style={{ color: "var(--text-muted)" }}
                >
                  {showPRs ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
              </div>

              {showPRs && (
                <div className="p-4">
                  {/* Filter buttons */}
                  <div className="flex items-center gap-1 mb-4">
                    {(["all", "open", "merged", "closed"] as const).map(
                      (filter) => {
                        const counts = {
                          all: stats.recentPRs.length,
                          open: stats.recentPRs.filter(
                            (pr) => pr.state === "open",
                          ).length,
                          merged: stats.recentPRs.filter(
                            (pr) => pr.state === "merged",
                          ).length,
                          closed: stats.recentPRs.filter(
                            (pr) => pr.state === "closed",
                          ).length,
                        };
                        const colors = {
                          all: "var(--text-muted)",
                          open: "var(--pr-open)",
                          merged: "var(--pr-merged)",
                          closed: "var(--pr-closed)",
                        };
                        return (
                          <button
                            key={filter}
                            onClick={(e) => {
                              e.stopPropagation();
                              setPrFilter(filter);
                            }}
                            className="text-[10px] px-2 py-1 rounded transition-all flex items-center gap-1.5"
                            style={{
                              background:
                                prFilter === filter
                                  ? "var(--bg-tertiary)"
                                  : "transparent",
                              border: `1px solid ${prFilter === filter ? colors[filter] : "var(--border-subtle)"}`,
                              color:
                                prFilter === filter
                                  ? colors[filter]
                                  : "var(--text-dim)",
                            }}
                          >
                            <span className="capitalize">{filter}</span>
                            <span style={{ opacity: 0.7 }}>
                              ({counts[filter]})
                            </span>
                          </button>
                        );
                      },
                    )}
                  </div>
                  <div className="space-y-2">
                    {stats.recentPRs
                      .filter(
                        (pr) => prFilter === "all" || pr.state === prFilter,
                      )
                      .map((pr) => (
                        <div
                          key={pr.number}
                          className="p-3 rounded-md"
                          style={{
                            background: "var(--bg-tertiary)",
                            border: "1px solid var(--border-subtle)",
                          }}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 pt-0.5">
                              {pr.state === "merged" ? (
                                <GitMerge
                                  className="w-4 h-4"
                                  style={{ color: "var(--pr-merged)" }}
                                />
                              ) : pr.state === "open" ? (
                                <GitPullRequest
                                  className="w-4 h-4"
                                  style={{ color: "var(--pr-open)" }}
                                />
                              ) : (
                                <GitPullRequestClosed
                                  className="w-4 h-4"
                                  style={{ color: "var(--pr-closed)" }}
                                />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <a
                                  href={pr.html_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm font-medium truncate hover:underline"
                                  style={{ color: "var(--text)" }}
                                >
                                  {pr.title}
                                </a>
                                <span
                                  className="text-xs flex-shrink-0"
                                  style={{ color: "var(--text-dim)" }}
                                >
                                  #{pr.number}
                                </span>
                              </div>
                              <div
                                className="mt-1 flex items-center gap-3 text-xs"
                                style={{ color: "var(--text-muted)" }}
                              >
                                <span>
                                  by{" "}
                                  <button
                                    onClick={() =>
                                      handleUserClick(pr.user.login)
                                    }
                                    className="hover:underline"
                                    style={{ color: "var(--text)" }}
                                  >
                                    {pr.user.login}
                                  </button>
                                </span>
                                <span>•</span>
                                <span>
                                  {new Date(pr.created_at).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!stats && !loading && !error && (
          <div
            className="p-4 rounded-lg"
            style={{
              background: "var(--bg-secondary)",
              border: "1px solid var(--border)",
            }}
          >
            <div className="flex flex-col items-center justify-center py-16">
              <RefreshCw
                className="w-12 h-12 mb-4"
                style={{ color: "var(--text-dim)" }}
              />
              <p
                className="text-lg font-medium mb-2"
                style={{ color: "var(--text)" }}
              >
                Ready to analyze
              </p>
              <p
                className="text-sm text-center max-w-md"
                style={{ color: "var(--text-muted)" }}
              >
                Enter a GitHub repository URL above to begin analyzing
                contributions and pull request activity.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Token Settings Modal */}
      <TokenSettings
        isOpen={showTokenSettings}
        onClose={() => setShowTokenSettings(false)}
        onTokenSaved={() => {
          setHasToken(true);
          setShowTokenNotification(false);
        }}
      />

      {/* Footer */}
      <footer
        className="rounded-t-lg"
        style={{
          background: "var(--bg-secondary)",
          borderTop: "1px solid var(--border)",
          marginTop: "auto",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div
            className="flex flex-col sm:flex-row justify-between items-center gap-3 text-xs"
            style={{ color: "var(--text-muted)" }}
          >
            <div className="flex items-center gap-4">
              <span>© {new Date().getFullYear()} Gitivity</span>
              <span style={{ color: "var(--text-dim)" }}>
                Not affiliated with GitHub
              </span>
            </div>
            <div className="flex items-center gap-4">
              <a
                href="https://github.com/vee1e"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--text-muted)" }}
              >
                @vee1e
              </a>
              <a
                href="https://linkedin.com/in/lakshitverma"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--text-muted)" }}
              >
                LinkedIn
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;
