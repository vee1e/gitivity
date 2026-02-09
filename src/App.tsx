import { useState, useEffect, useRef, useCallback } from "react";
import {
  Github,
  GitPullRequest,
  GitPullRequestClosed,
  GitMerge,
  Loader2,
  Users,
  RefreshCw,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  KeyRound,
  AlertCircle,
  X,
  Check,
  Cpu,
  Database,
  FolderGit,
} from "lucide-react";
import {
  fetchRepoStats,
  fetchUserStats,
  registerLoadingHandler,
  fetchOrgRepos,
  fetchOrgMembers,
} from "./utils/github";
import type { RepoStats, UserStats, TimeFilter } from "./types";
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
  const [loadingProgress, setLoadingProgress] = useState("");
  const [showTokenSettings, setShowTokenSettings] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [showTokenNotification, setShowTokenNotification] = useState(false);

  // Search mode: 'repo' or 'member'
  const [searchMode, setSearchMode] = useState<'repo' | 'member'>('repo');

  // Autocomplete state
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [memberSuggestions, setMemberSuggestions] = useState<Array<{ login: string; avatar_url: string }>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [suggestionsPage, setSuggestionsPage] = useState(1);
  const [suggestionsOrg, setSuggestionsOrg] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    registerLoadingHandler(setLoadingProgress);
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
      if (match && !trimmed.includes('github.com')) {
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
        if (org && (queryPart === '' || queryPart.length < 30)) {
          setIsFetchingSuggestions(true);
          try {
            if (searchMode === 'repo') {
              const repos = await fetchOrgRepos(org, 1);
              // Filter repos based on what's already typed
              const filtered = queryPart
                ? repos.filter(r => r.toLowerCase().startsWith(queryPart.toLowerCase()))
                : repos;
              setSuggestions(filtered);
              setShowSuggestions(filtered.length > 0);
            } else {
              // Member mode
              const members = await fetchOrgMembers(org, 1);
              // Filter members based on what's already typed
              const filtered = queryPart
                ? members.filter(m => m.login.toLowerCase().startsWith(queryPart.toLowerCase()))
                : members;
              setMemberSuggestions(filtered);
              setShowSuggestions(filtered.length > 0);
            }
            setSelectedIndex(0);
          } catch (err) {
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
      const selectedElement = suggestionsRef.current.children[index + 1] as HTMLElement; // +1 for header
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    const currentSuggestions = searchMode === 'repo' ? suggestions : memberSuggestions.map(m => m.login);
    if (!showSuggestions || currentSuggestions.length === 0) return;

    switch (e.key) {
      case 'Tab':
        e.preventDefault();
        if (e.shiftKey) {
          // Shift+Tab: move up
          const newIndex = selectedIndex === 0 ? currentSuggestions.length - 1 : selectedIndex - 1;
          setSelectedIndex(newIndex);
          scrollSelectedIntoView(newIndex);
        } else {
          // Tab: move down
          const newIndex = (selectedIndex + 1) % currentSuggestions.length;
          setSelectedIndex(newIndex);
          scrollSelectedIntoView(newIndex);
        }
        break;
      case 'Enter':
        e.preventDefault();
        if (currentSuggestions[selectedIndex]) {
          const match = repoUrl.match(/^([a-zA-Z0-9_-]+)\/(.*)$/);
          if (match) {
            setRepoUrl(`${match[1]}/${currentSuggestions[selectedIndex]}`);
            setShowSuggestions(false);
          }
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        {
          const newIndex = (selectedIndex + 1) % currentSuggestions.length;
          setSelectedIndex(newIndex);
          scrollSelectedIntoView(newIndex);
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        {
          const newIndex = selectedIndex === 0 ? currentSuggestions.length - 1 : selectedIndex - 1;
          setSelectedIndex(newIndex);
          scrollSelectedIntoView(newIndex);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        break;
    }
  }, [showSuggestions, suggestions, memberSuggestions, selectedIndex, repoUrl, scrollSelectedIntoView, searchMode]);

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
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle scroll for lazy loading more items
  const handleScroll = useCallback(async () => {
    if (!suggestionsRef.current || isLoadingMore || isFetchingSuggestions) return;

    const { scrollTop, scrollHeight, clientHeight } = suggestionsRef.current;
    const scrollPercent = (scrollTop + clientHeight) / scrollHeight;

    // Load more when within 20% of bottom
    if (scrollPercent > 0.8 && suggestionsOrg) {
      setIsLoadingMore(true);
      try {
        const nextPage = suggestionsPage + 1;

        if (searchMode === 'repo') {
          const newRepos = await fetchOrgRepos(suggestionsOrg, nextPage);
          if (newRepos.length > 0) {
            setSuggestions(prev => [...prev, ...newRepos]);
            setSuggestionsPage(nextPage);
          }
        } else {
          const newMembers = await fetchOrgMembers(suggestionsOrg, nextPage);
          if (newMembers.length > 0) {
            setMemberSuggestions(prev => [...prev, ...newMembers]);
            setSuggestionsPage(nextPage);
          }
        }
      } catch (err) {
        console.error('Error loading more items:', err);
      } finally {
        setIsLoadingMore(false);
      }
    }
  }, [isLoadingMore, isFetchingSuggestions, suggestionsOrg, suggestionsPage, searchMode]);

  // Attach scroll listener
  useEffect(() => {
    const dropdown = suggestionsRef.current;
    if (dropdown) {
      dropdown.addEventListener('scroll', handleScroll);
      return () => dropdown.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  const normalizeRepoUrl = (url: string): string => {
    const trimmed = url.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    if (trimmed.startsWith('github.com/')) {
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

    if (searchMode === 'member') {
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
    setLoadingProgress("Fetching repository data...");

    try {
      const normalizedUrl = normalizeRepoUrl(repoUrl);
      const data = await fetchRepoStats(normalizedUrl, timeFilter);
      setStats(data);
      setLoadingProgress("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch repository statistics");
    } finally {
      setLoading(false);
    }
  };

  const handleUserClick = async (username: string) => {
    setLoadingUser(true);
    setLoadingProgress(`Loading details for ${username}...`);
    try {
      const userStats = await fetchUserStats(username, timeFilter);
      setSelectedUser(userStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch user statistics");
    } finally {
      setLoadingUser(false);
      setLoadingProgress("");
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
    if (loading) return <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--primary)' }} />;
    if (stats) return <Check className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />;
    return <Database className="w-4 h-4" style={{ color: 'var(--text-dim)' }} />;
  };

  return (
    <div className="min-h-screen terminal-container">
      {/* Token Notification */}
      {showTokenNotification && (
        <div className="fixed bottom-4 right-4 max-w-md z-50 animate-fade-in">
          <div className="p-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <AlertCircle className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                  API Rate Limits
                </h3>
                <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                  Add GitHub PAT to raise API limit from 60 to 5,000 requests/hour
                </p>
                <div className="mt-3 flex gap-2">
                  <button onClick={openTokenSettings} className="terminal-button-primary text-xs">
                    Add Token
                  </button>
                  <button onClick={dismissTokenNotification} className="terminal-button-secondary text-xs">
                    Dismiss
                  </button>
                </div>
              </div>
              <button onClick={dismissTokenNotification} className="flex-shrink-0" style={{ color: 'var(--text-dim)' }}>
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <span className="font-bold text-lg" style={{ color: 'var(--text)' }}>Gitivity</span>
            <span className="text-xs px-2 py-0.5" style={{ color: 'var(--text-dim)', border: '1px solid var(--border-subtle)' }}>v1.0.0</span>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTokenSettings(true)}
              className="terminal-button-secondary flex items-center gap-1.5 text-xs"
              style={{ borderColor: hasToken ? 'var(--text-muted)' : 'var(--border)' }}
            >
              {hasToken ? (
                <>
                  <Check className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
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
      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Input Form */}
        <div className="p-4 mb-6" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-6 relative">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs" style={{ color: 'var(--text-dim)' }}>
                    {searchMode === 'repo' ? 'REPOSITORY' : 'ORGANIZATION MEMBER'}
                  </label>
                  {/* Mode Toggle */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setSearchMode('repo');
                        setRepoUrl('');
                        setShowSuggestions(false);
                      }}
                      className="text-[10px] px-2 py-0.5 transition-all"
                      style={{
                        background: searchMode === 'repo' ? 'var(--bg-tertiary)' : 'transparent',
                        border: '1px solid var(--border-subtle)',
                        color: searchMode === 'repo' ? 'var(--text)' : 'var(--text-dim)',
                      }}
                    >
                      Repo
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchMode('member');
                        setRepoUrl('');
                        setShowSuggestions(false);
                      }}
                      className="text-[10px] px-2 py-0.5 transition-all"
                      style={{
                        background: searchMode === 'member' ? 'var(--bg-tertiary)' : 'transparent',
                        border: '1px solid var(--border-subtle)',
                        color: searchMode === 'member' ? 'var(--text)' : 'var(--text-dim)',
                      }}
                    >
                      Member
                    </button>
                  </div>
                </div>
                <div className="terminal-input-line">
                  <span className="terminal-prompt">$</span>
                  <input
                    ref={inputRef}
                    type="text"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={searchMode === 'repo' ? "org/repo (e.g., facebook/react)" : "org/username (e.g., facebook/zuck)"}
                    className="terminal-input"
                    required
                    autoComplete="off"
                  />
                </div>

                {/* Autocomplete Dropdown */}
                {showSuggestions && (
                  <div
                    ref={suggestionsRef}
                    className="absolute left-0 right-0 mt-1 z-50"
                    style={{
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border)',
                      maxHeight: '300px',
                      overflowY: 'auto',
                    }}
                  >
                    {isFetchingSuggestions && (searchMode === 'repo' ? suggestions.length === 0 : memberSuggestions.length === 0) ? (
                      <div className="p-3 text-xs flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        {searchMode === 'repo' ? 'Loading repositories...' : 'Loading members...'}
                      </div>
                    ) : (
                      <>
                        <div
                          className="px-3 py-1.5 text-[10px] uppercase flex items-center justify-between sticky top-0 z-10"
                          style={{
                            color: 'var(--text-dim)',
                            borderBottom: '1px solid var(--border-subtle)',
                            background: 'var(--bg-tertiary)'
                          }}
                        >
                          <span>Tab ↓ Shift+Tab ↑ Enter to select</span>
                          <span style={{ color: 'var(--text-dim)' }}>
                            {searchMode === 'repo'
                              ? `${suggestions.length} repos`
                              : `${memberSuggestions.length} members`
                            }
                          </span>
                        </div>
                        <div>
                          {searchMode === 'repo' ? (
                            // Repo suggestions
                            suggestions.map((repo, index) => (
                              <button
                                key={repo}
                                type="button"
                                onClick={() => handleSuggestionClick(repo)}
                                className="w-full text-left px-3 py-2 text-sm flex items-center gap-2"
                                style={{
                                  background: index === selectedIndex ? 'var(--bg-secondary)' : 'transparent',
                                  color: index === selectedIndex ? 'var(--text)' : 'var(--text-muted)',
                                  borderLeft: index === selectedIndex ? '2px solid var(--primary)' : '2px solid transparent',
                                }}
                                onMouseEnter={() => setSelectedIndex(index)}
                              >
                                <FolderGit className="w-3.5 h-3.5" />
                                {repo}
                              </button>
                            ))
                          ) : (
                            // Member suggestions
                            memberSuggestions.map((member, index) => (
                              <button
                                key={member.login}
                                type="button"
                                onClick={() => handleSuggestionClick(member.login)}
                                className="w-full text-left px-3 py-2 text-sm flex items-center gap-2"
                                style={{
                                  background: index === selectedIndex ? 'var(--bg-secondary)' : 'transparent',
                                  color: index === selectedIndex ? 'var(--text)' : 'var(--text-muted)',
                                  borderLeft: index === selectedIndex ? '2px solid var(--primary)' : '2px solid transparent',
                                }}
                                onMouseEnter={() => setSelectedIndex(index)}
                              >
                                <img
                                  src={member.avatar_url}
                                  alt={member.login}
                                  className="w-5 h-5 rounded-full"
                                  style={{ border: '1px solid var(--border-subtle)' }}
                                />
                                {member.login}
                              </button>
                            ))
                          )}
                        </div>
                        {(isFetchingSuggestions || isLoadingMore) && (
                          <div
                            className="px-3 py-2 text-xs flex items-center justify-center gap-2 sticky bottom-0"
                            style={{
                              color: 'var(--text-dim)',
                              background: 'var(--bg-tertiary)',
                              borderTop: '1px solid var(--border-subtle)'
                            }}
                          >
                            <Loader2 className="w-3 h-3 animate-spin" />
                            {isLoadingMore
                              ? `Loading more... (${searchMode === 'repo' ? suggestions.length : memberSuggestions.length} loaded)`
                              : 'Loading...'
                            }
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
              
              <div className="md:col-span-3">
                <label className="block text-xs mb-1.5" style={{ color: 'var(--text-dim)' }}>
                  TIME PERIOD
                </label>
                <div className="relative">
                  <select
                    value={timeFilter}
                    onChange={(e) => setTimeFilter(e.target.value as TimeFilter)}
                    className="w-full terminal-input"
                    style={{ appearance: 'none', paddingRight: '32px' }}
                  >
                    <option value="2w">2 Weeks</option>
                    <option value="1m">1 Month</option>
                    <option value="3m">3 Months</option>
                    <option value="6m">6 Months</option>
                    <option value="all">All Time</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
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
                    <>
                      <span>Analyze</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Status Bar */}
        <div className="mb-6 flex items-center gap-4 text-xs" style={{ color: 'var(--text-dim)' }}>
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4" />
            <span>{loading ? 'PROCESSING' : stats ? 'COMPLETED' : 'READY'}</span>
          </div>
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <span>{loadingProgress || (stats ? `Found ${stats.contributors.length} contributors` : 'Waiting for input')}</span>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-4 mb-6" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--text-dim)' }}>
            <div className="flex items-center gap-3">
              <X className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Error</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && !stats && (
          <div className="p-4 mb-6" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
                <p className="text-sm" style={{ color: 'var(--text)' }}>{loadingProgress}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>This may take a moment for large repositories</p>
              </div>
            </div>
          </div>
        )}

        {/* User Loading Modal */}
        {loadingUser && (
          <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'rgba(0,0,0,0.8)' }}>
            <div className="p-6" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--text-muted)' }} />
                <p style={{ color: 'var(--text)' }}>Loading user statistics...</p>
              </div>
            </div>
          </div>
        )}

        {/* User Stats Modal */}
        {selectedUser && (
          <UserStatsModal stats={selectedUser} onClose={() => setSelectedUser(null)} />
        )}

        {/* Stats Display */}
        {stats && (
          <div className="space-y-6">
            {/* Contributors Section */}
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              <div className="p-3 flex items-center gap-3" style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-subtle)' }}>
                <Users className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Contributors</span>
                <div className="flex-1" />
                <span className="text-xs px-2 py-0.5" style={{ color: 'var(--text-dim)', border: '1px solid var(--border-subtle)' }}>{stats.contributors.length} total</span>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {stats.contributors.map((contributor) => (
                    <button
                      key={contributor.username}
                      onClick={() => handleUserClick(contributor.username)}
                      className="text-left p-3"
                      style={{ 
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <img
                          src={contributor.avatarUrl}
                          alt={contributor.username}
                          className="w-10 h-10"
                          style={{ border: '1px solid var(--border-subtle)' }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
                              {contributor.username}
                            </span>
                            {contributor.isMaintainer ? (
                              <span className="text-[10px] px-1.5 py-0.5" style={{ border: '1px solid var(--text-muted)', color: 'var(--text-muted)' }}>
                                Maint
                              </span>
                            ) : (
                              <span className="text-[10px] px-1.5 py-0.5" style={{ border: '1px solid var(--text-dim)', color: 'var(--text-dim)' }}>
                                Contr
                              </span>
                            )}
                          </div>
                          
                          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                            <div className="flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                              <GitPullRequest className="w-3 h-3" />
                              <span>{contributor.totalPRs} PRs</span>
                            </div>
                            <div className="flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                              <GitMerge className="w-3 h-3" style={{ color: 'var(--pr-merged)' }} />
                              <span>{contributor.mergedPRs} merged</span>
                            </div>
                            <div className="flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                              <GitPullRequest className="w-3 h-3" style={{ color: 'var(--pr-open)' }} />
                              <span>{contributor.openPRs} open</span>
                            </div>
                            <div className="flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                              <GitPullRequestClosed className="w-3 h-3" style={{ color: 'var(--pr-closed)' }} />
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

            {/* Pull Requests Section */}
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              <div 
                className="p-3 flex items-center gap-3 cursor-pointer"
                style={{ background: 'var(--bg-tertiary)', borderBottom: showPRs ? '1px solid var(--border-subtle)' : 'none' }}
                onClick={togglePRs}
              >
                <GitPullRequest className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Pull Requests</span>
                <div className="flex-1" />
                <span className="text-xs px-2 py-0.5" style={{ color: 'var(--text-dim)', border: '1px solid var(--border-subtle)' }}>{stats.totalPRs} total</span>
                <button className="ml-2 p-1 hover:opacity-80" style={{ color: 'var(--text-muted)' }}>
                  {showPRs ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>
              
              {showPRs && (
                <div className="p-4">
                  <div className="space-y-2">
                    {stats.recentPRs.map((pr) => (
                      <div
                        key={pr.number}
                        className="p-3"
                        style={{ 
                          background: 'var(--bg-tertiary)',
                          border: '1px solid var(--border-subtle)',
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 pt-0.5">
                            {pr.state === 'merged' ? (
                              <GitMerge className="w-4 h-4" style={{ color: 'var(--pr-merged)' }} />
                            ) : pr.state === 'open' ? (
                              <GitPullRequest className="w-4 h-4" style={{ color: 'var(--pr-open)' }} />
                            ) : (
                              <GitPullRequestClosed className="w-4 h-4" style={{ color: 'var(--pr-closed)' }} />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <a
                                href={pr.html_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm font-medium truncate hover:underline"
                                style={{ color: 'var(--text)' }}
                              >
                                {pr.title}
                              </a>
                              <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-dim)' }}>
                                #{pr.number}
                              </span>
                            </div>
                            <div className="mt-1 flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                              <span>by{' '}
                                <button
                                  onClick={() => handleUserClick(pr.user.login)}
                                  className="hover:underline"
                                  style={{ color: 'var(--text)' }}
                                >
                                  {pr.user.login}
                                </button>
                              </span>
                              <span>•</span>
                              <span>{new Date(pr.created_at).toLocaleDateString()}</span>
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
          <div className="p-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
            <div className="flex flex-col items-center justify-center py-16">
              <RefreshCw className="w-12 h-12 mb-4" style={{ color: 'var(--text-dim)' }} />
              <p className="text-lg font-medium mb-2" style={{ color: 'var(--text)' }}>Ready to analyze</p>
              <p className="text-sm text-center max-w-md" style={{ color: 'var(--text-muted)' }}>
                Enter a GitHub repository URL above to begin analyzing contributions
                and pull request activity.
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
      <footer style={{ 
        background: 'var(--bg-secondary)', 
        borderTop: '1px solid var(--border)',
        marginTop: 'auto'
      }}>
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
            <div className="flex items-center gap-4">
              <span>© {new Date().getFullYear()} Gitivity</span>
              <span style={{ color: 'var(--text-dim)' }}>Not affiliated with GitHub</span>
            </div>
            <div className="flex items-center gap-4">
              <a 
                href="https://github.com/vee1e" 
                target="_blank" 
                rel="noopener noreferrer"
                style={{ color: 'var(--text-muted)' }}
              >
                @vee1e
              </a>
              <a 
                href="https://linkedin.com/in/lakshitverma" 
                target="_blank" 
                rel="noopener noreferrer"
                style={{ color: 'var(--text-muted)' }}
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
