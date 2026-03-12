import { Check, Circle, Loader2 } from "lucide-react";
import type { LoadingProgressState } from "../utils/github";

type LoadingMode = "repo" | "org" | "member";

interface LoadingStep {
  key: string;
  label: string;
}

interface LoadingProgressPanelProps {
  mode: LoadingMode;
  progress: LoadingProgressState | null;
  fallbackMessage: string;
  compact?: boolean;
}

const MODE_STEPS: Record<LoadingMode, LoadingStep[]> = {
  repo: [
    { key: "repo", label: "Repository" },
    { key: "collaborators", label: "Collaborators" },
    { key: "repo-prs", label: "Pull Requests" },
    { key: "processing", label: "Contributors" },
    { key: "completed", label: "Completed" },
  ],
  org: [
    { key: "org-repos", label: "Repositories" },
    { key: "org-scan", label: "Organization Scan" },
    { key: "finalizing", label: "Finalizing" },
    { key: "completed", label: "Completed" },
  ],
  member: [
    { key: "user", label: "Profile" },
    { key: "user-prs", label: "Pull Requests" },
    { key: "user-processing", label: "Repositories" },
    { key: "maintainer-check", label: "Maintainer Check" },
    { key: "completed", label: "Completed" },
  ],
};

const MODE_LABEL: Record<LoadingMode, string> = {
  repo: "Repository Analysis",
  org: "Organization Analysis",
  member: "Member Analysis",
};

const prettifyStage = (stage: string): string =>
  stage
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const getActiveIndex = (
  steps: LoadingStep[],
  stage: string | undefined,
  percentage: number,
): number => {
  if (stage) {
    const exactMatchIndex = steps.findIndex((step) => step.key === stage);
    if (exactMatchIndex >= 0) {
      return exactMatchIndex;
    }
  }

  if (percentage >= 100) {
    return steps.length - 1;
  }

  if (percentage <= 0) {
    return 0;
  }

  const estimatedIndex = Math.floor((percentage / 100) * steps.length);
  return Math.min(steps.length - 1, Math.max(0, estimatedIndex));
};

const getStepStatus = (
  index: number,
  activeIndex: number,
  isComplete: boolean,
): "pending" | "active" | "completed" => {
  if (isComplete && index <= activeIndex) {
    return "completed";
  }
  if (index < activeIndex) {
    return "completed";
  }
  if (index === activeIndex) {
    return "active";
  }
  return "pending";
};

export function LoadingProgressPanel({
  mode,
  progress,
  fallbackMessage,
  compact = false,
}: LoadingProgressPanelProps) {
  const steps = MODE_STEPS[mode];
  const percentage = progress?.percentage ?? 0;
  const safePercentage = Math.min(100, Math.max(0, percentage));
  const activeIndex = getActiveIndex(steps, progress?.stage, safePercentage);
  const isComplete = progress?.stage === "completed" || safePercentage >= 100;
  const stageLabel =
    steps.find((step) => step.key === progress?.stage)?.label ??
    (progress?.stage ? prettifyStage(progress.stage) : "Initializing");

  return (
    <div
      className={`rounded-lg border relative overflow-hidden ${compact ? "p-4" : "p-5"}`}
      style={{
        background: "linear-gradient(180deg, var(--bg-secondary), var(--bg-tertiary))",
        borderColor: "var(--border)",
      }}
    >
      <div
        className="absolute top-0 left-0 h-px w-full"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, var(--text-muted) 30%, var(--primary) 50%, var(--text-muted) 70%, transparent 100%)",
        }}
      />

      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="loading-signal-dot" />
          <span
            className="text-[10px] uppercase tracking-[0.12em] truncate"
            style={{ color: "var(--text-dim)" }}
          >
            {MODE_LABEL[mode]}
          </span>
        </div>
        <div className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
          {safePercentage}%
        </div>
      </div>

      <p
        className={`${compact ? "text-sm" : "text-base"} font-medium leading-snug`}
        style={{ color: "var(--text)" }}
      >
        {progress?.message || fallbackMessage}
      </p>

      <div className="mt-3">
        <div className="h-2 rounded-full overflow-hidden loading-progress-track">
          <div
            className="h-full loading-progress-fill"
            style={{
              width: `${Math.max(3, safePercentage)}%`,
            }}
          />
        </div>
        <div
          className="mt-1.5 text-[10px] flex items-center justify-between"
          style={{ color: "var(--text-dim)" }}
        >
          <span>{stageLabel}</span>
          <span>
            {progress && progress.total > 1
              ? `${Math.min(progress.completed, progress.total)}/${progress.total}`
              : isComplete
                ? "Done"
                : "In progress"}
          </span>
        </div>
      </div>

      <div
        className={`mt-4 grid gap-2 ${compact ? "grid-cols-2" : mode === "org" ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2 md:grid-cols-5"}`}
      >
        {steps.map((step, index) => {
          const status = getStepStatus(index, activeIndex, isComplete);
          const isActive = status === "active";
          const isCompleted = status === "completed";

          return (
            <div
              key={step.key}
              className="rounded-md px-2.5 py-2 flex items-center gap-2 border min-w-0"
              style={{
                background: isActive ? "var(--bg-secondary)" : "var(--bg)",
                borderColor: isCompleted || isActive ? "var(--text-muted)" : "var(--border-subtle)",
                opacity: isCompleted || isActive ? 1 : 0.72,
              }}
            >
              <span
                className="flex-shrink-0"
                style={{ color: isCompleted || isActive ? "var(--text-muted)" : "var(--text-dim)" }}
              >
                {isCompleted ? (
                  <Check className="w-3.5 h-3.5" />
                ) : isActive ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Circle className="w-3.5 h-3.5" />
                )}
              </span>
              <span
                className="text-[10px] uppercase tracking-wide truncate"
                style={{ color: isCompleted || isActive ? "var(--text)" : "var(--text-dim)" }}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
