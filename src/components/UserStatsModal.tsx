import {
  X,
  GitPullRequest,
  GitPullRequestClosed,
  GitMerge,
  ExternalLink,
  Calendar,
  Activity,
  Shield,
  Users,
  FolderGit,
} from "lucide-react";
import type { UserStats } from "../types";

interface UserStatsModalProps {
  stats: UserStats;
  onClose: () => void;
}

export function UserStatsModal({ stats, onClose }: UserStatsModalProps) {
  const sortedRepos = Object.entries(stats.repositories).sort(
    ([, a], [, b]) => b.totalPRs - a.totalPRs
  );

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 z-50 animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.85)' }}
      onClick={handleBackdropClick}
    >
      <div
        className="terminal-window w-full max-w-4xl max-h-[90vh] overflow-hidden"
        style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div 
          className="p-3 flex items-center justify-between"
          style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-subtle)' }}
        >
          <div className="flex items-center gap-3">
            <img
              src={stats.avatarUrl}
              alt={stats.username}
              className="w-8 h-8 rounded"
              style={{ border: '1px solid var(--border)' }}
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold" style={{ color: 'var(--text)' }}>
                  {stats.username}
                </span>
                {stats.isMaintainer ? (
                  <span 
                    className="text-[10px] px-1.5 py-0.5 flex items-center gap-1"
                    style={{ border: '1px solid var(--text-muted)', color: 'var(--text-muted)' }}
                  >
                    <Shield className="w-3 h-3" />
                    Maint
                  </span>
                ) : (
                  <span 
                    className="text-[10px] px-1.5 py-0.5 flex items-center gap-1"
                    style={{ border: '1px solid var(--text-dim)', color: 'var(--text-dim)' }}
                  >
                    <Users className="w-3 h-3" />
                    Contr
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex-1" />
          <a
            href={`https://github.com/${stats.username}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 hover:opacity-80"
            style={{ color: 'var(--text-muted)' }}
          >
            <ExternalLink className="w-4 h-4" />
          </a>
          <button
            onClick={onClose}
            className="p-1 hover:opacity-80"
            style={{ color: 'var(--text-muted)' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div 
          className="p-4 overflow-y-auto max-h-[calc(90vh-60px)]"
          style={{ background: 'var(--bg-secondary)' }}
        >
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div 
              className="p-3"
              style={{ 
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border)',
                borderLeft: '3px solid var(--primary)'
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <GitPullRequest className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                <span className="text-lg font-bold" style={{ color: 'var(--text)' }}>
                  {stats.totalStats.totalPRs}
                </span>
              </div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Total PRs</p>
            </div>

            <div 
              className="p-3"
              style={{ 
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border)',
                borderLeft: '3px solid var(--pr-merged)'
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <GitMerge className="w-4 h-4" style={{ color: 'var(--pr-merged)' }} />
                <span className="text-lg font-bold" style={{ color: 'var(--text)' }}>
                  {stats.totalStats.mergedPRs}
                </span>
              </div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Merged</p>
            </div>

            <div 
              className="p-3"
              style={{ 
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border)',
                borderLeft: '3px solid var(--pr-open)'
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <GitPullRequest className="w-4 h-4" style={{ color: 'var(--pr-open)' }} />
                <span className="text-lg font-bold" style={{ color: 'var(--text)' }}>
                  {stats.totalStats.openPRs}
                </span>
              </div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Open</p>
            </div>

            <div 
              className="p-3"
              style={{ 
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border)',
                borderLeft: '3px solid var(--pr-closed)'
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <GitPullRequestClosed className="w-4 h-4" style={{ color: 'var(--pr-closed)' }} />
                <span className="text-lg font-bold" style={{ color: 'var(--text)' }}>
                  {stats.totalStats.closedPRs}
                </span>
              </div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Closed</p>
            </div>
          </div>

          {/* Repositories */}
          {sortedRepos.length > 0 && (
            <div className="mb-6">
              <h3 
                className="text-sm font-semibold mb-3 flex items-center gap-2"
                style={{ color: 'var(--text)' }}
              >
                <Activity className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                Contributions by Repository
              </h3>
              <div className="space-y-2">
                {sortedRepos.map(([repo, repoStats]) => (
                  <div
                    key={repo}
                    className="p-3"
                    style={{ 
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <a
                        href={`https://github.com/${repo}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium hover:underline flex items-center gap-1.5"
                        style={{ color: 'var(--primary)' }}
                      >
                        <FolderGit className="w-4 h-4" />
                        <span>{repo}</span>
                      </a>
                      <span 
                        className="text-[10px] px-1.5 py-0.5"
                        style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}
                      >
                        {repoStats.totalPRs} PRs
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-xs">
                      <div className="flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                        <GitPullRequest className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
                        <span>{repoStats.totalPRs}</span>
                      </div>
                      <div className="flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                        <GitMerge className="w-3 h-3" style={{ color: 'var(--pr-merged)' }} />
                        <span>{repoStats.mergedPRs}</span>
                      </div>
                      <div className="flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                        <GitPullRequest className="w-3 h-3" style={{ color: 'var(--pr-open)' }} />
                        <span>{repoStats.openPRs}</span>
                      </div>
                      <div className="flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                        <GitPullRequestClosed className="w-3 h-3" style={{ color: 'var(--pr-closed)' }} />
                        <span>{repoStats.closedPRs}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Pull Requests */}
          <div>
            <h3 
              className="text-sm font-semibold mb-3 flex items-center gap-2"
              style={{ color: 'var(--text)' }}
            >
              <Calendar className="w-4 h-4" style={{ color: 'var(--primary)' }} />
              Recent Pull Requests
            </h3>
            
            {stats.pullRequests.length > 0 ? (
              <div 
                className="overflow-x-auto"
                style={{ border: '1px solid var(--border-subtle)' }}
              >
                <table className="w-full text-xs">
                  <thead style={{ background: 'var(--bg-tertiary)' }}>
                    <tr>
                      <th 
                        className="px-4 py-2 text-left font-medium"
                        style={{ color: 'var(--text-dim)' }}
                      >
                        Repo
                      </th>
                      <th 
                        className="px-4 py-2 text-left font-medium"
                        style={{ color: 'var(--text-dim)' }}
                      >
                        Title
                      </th>
                      <th 
                        className="px-4 py-2 text-left font-medium"
                        style={{ color: 'var(--text-dim)' }}
                      >
                        Status
                      </th>
                      <th 
                        className="px-4 py-2 text-left font-medium"
                        style={{ color: 'var(--text-dim)' }}
                      >
                        Date
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.pullRequests.map((pr) => (
                      <tr
                        key={`${pr.repository_name}-${pr.number}`}
                        className="hover:opacity-80 transition-opacity"
                        style={{ 
                          background: 'var(--bg-secondary)',
                          borderBottom: '1px solid var(--border-subtle)'
                        }}
                      >
                        <td 
                          className="px-4 py-2 whitespace-nowrap"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          {pr.repository_name}
                        </td>
                        <td className="px-4 py-2">
                          <a
                            href={pr.html_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline line-clamp-1"
                            style={{ color: 'var(--primary)' }}
                          >
                            {pr.title}
                          </a>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <span
                            className="text-[10px] px-1.5 py-0.5"
                            style={{
                              border: '1px solid',
                              borderColor: pr.merged_at 
                                ? 'var(--pr-merged)' 
                                : pr.state === 'open' 
                                  ? 'var(--pr-open)' 
                                  : 'var(--text-dim)',
                              color: pr.merged_at 
                                ? 'var(--pr-merged)' 
                                : pr.state === 'open' 
                                  ? 'var(--pr-open)' 
                                  : 'var(--text-muted)'
                            }}
                          >
                            {pr.merged_at ? 'merged' : pr.state}
                          </span>
                        </td>
                        <td 
                          className="px-4 py-2 whitespace-nowrap"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          {new Date(pr.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div 
                className="p-8 text-center"
                style={{ 
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-subtle)'
                }}
              >
                <p style={{ color: 'var(--text-muted)' }}>
                  No pull requests found in the selected time period.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
