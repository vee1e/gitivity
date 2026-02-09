import { useState } from "react";
import { KeyRound, Check, X, Info, FileKey, Shield } from "lucide-react";
import {
  saveGitHubToken,
  removeGitHubToken,
  hasGitHubToken,
} from "../utils/env";

interface TokenSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onTokenSaved?: () => void;
}

export function TokenSettings({
  isOpen,
  onClose,
  onTokenSaved,
}: TokenSettingsProps) {
  const [token, setToken] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [hasExistingToken, setHasExistingToken] = useState(hasGitHubToken());

  const saveToken = () => {
    if (!token.trim()) {
      setError("Please enter a valid token");
      return;
    }

    try {
      saveGitHubToken(token);
      setSaved(true);
      setHasExistingToken(true);
      setError("");

      if (onTokenSaved) {
        onTokenSaved();
      }

      setTimeout(() => {
        setSaved(false);
      }, 3000);
    } catch (err) {
      setError("Failed to save token");
    }
  };

  const deleteToken = () => {
    removeGitHubToken();
    setToken("");
    setHasExistingToken(false);
    setError("");
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center p-4 z-50"
      style={{ background: 'rgba(0,0,0,0.85)' }}
    >
      <div 
        className="max-w-md w-full"
        style={{ 
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)'
        }}
      >
        <div 
          className="p-3 flex items-center justify-between"
          style={{ 
            background: 'var(--bg-tertiary)', 
            borderBottom: '1px solid var(--border-subtle)'
          }}
        >
          <div className="flex items-center gap-2">
            <FileKey className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>GitHub Token</span>
          </div>
          <button
            onClick={onClose}
            style={{ color: 'var(--text-muted)' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4">
          <div className="mb-4">
            <h2 
              className="text-lg font-medium flex items-center gap-2 mb-3"
              style={{ color: 'var(--text)' }}
            >
              <KeyRound className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
              GitHub Access Token
            </h2>
            <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
              Add your GitHub Personal Access Token to increase API rate limits
              from 60 to 5,000 requests per hour.
            </p>
            <div 
              className="p-3 text-xs mb-4"
              style={{ 
                background: 'var(--bg-tertiary)',
                borderLeft: '2px solid var(--text-muted)',
                color: 'var(--text-muted)'
              }}
            >
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--text-muted)' }} />
                <p>
                  Create a token at{' '}
                  <a
                    href="https://github.com/settings/tokens"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                    style={{ color: 'var(--text)' }}
                  >
                    github.com/settings/tokens
                  </a>
                  {' '}with public_repo scope.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label 
                className="block text-xs mb-2"
                style={{ color: 'var(--text-dim)' }}
              >
                PERSONAL_ACCESS_TOKEN
              </label>
              <div className="terminal-input-line">
                <span className="terminal-prompt">$</span>
                <input
                  type="password"
                  value={token}
                  onChange={(e) => {
                    setToken(e.target.value);
                    setSaved(false);
                    setError("");
                  }}
                  placeholder="ghp_xxxxxxxxxxxxxxxx"
                  className="terminal-input"
                />
                {hasExistingToken && (
                  <Shield className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                )}
              </div>
              {error && (
                <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                  {error}
                </p>
              )}
              {saved && (
                <p 
                  className="mt-2 text-xs flex items-center gap-1"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <Check className="w-4 h-4" /> Token saved successfully!
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              {hasExistingToken && (
                <button
                  type="button"
                  onClick={deleteToken}
                  className="terminal-button-secondary"
                >
                  Remove
                </button>
              )}
              <button
                type="button"
                onClick={saveToken}
                className="terminal-button-primary"
              >
                Save Token
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
