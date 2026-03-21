import { useMemo } from "react";
import { AlertTriangle, RotateCcw, User, Bot } from "lucide-react";
import type { ChatMessage as ChatMessageType } from "../contexts/chat-context";
import { ThinkingIndicator } from "./thinking-indicator";
import { PlanDisplay } from "./plan-display";
import { StepTimeline } from "./step-timeline";
import { FileExploration } from "./file-exploration";
import { InlineDiffViewer } from "./inline-diff-viewer";
import { PatchDiffView } from "./patch-diff-view";
import { buildFileDiffWithHunks } from "../lib/hunk-model";

interface ChatMessageProps {
  message: ChatMessageType;
  onApplySelected?: (messageId: string) => void;
  onRejectProposal?: (messageId: string) => void;
  onIncludeAll?: (messageId: string) => void;
  onHunkAccept?: (messageId: string, hunkId: string) => void;
  onHunkReject?: (messageId: string, hunkId: string) => void;
  onFileAcceptAll?: (messageId: string, file: string) => void;
  onFileRejectAll?: (messageId: string, file: string) => void;
  onRetry?: (messageId: string) => void;
}

const PHASE_LABEL: Record<string, string> = {
  intent: "Planning",
  planning: "Planning",
  executing: "Executing",
  reasoning: "Analyzing",
  generating: "Generating",
  awaiting_approval: "Awaiting Approval",
};

export function ChatMessage({
  message,
  onApplySelected,
  onRejectProposal,
  onIncludeAll,
  onHunkAccept,
  onHunkReject,
  onFileAcceptAll,
  onFileRejectAll,
  onRetry,
}: ChatMessageProps) {
  const isUser = message.role === "user";
  const isStreaming = message.streaming && message.streamingPhase !== "done";
  const pending = message.pendingPatch;
  const hunkStatuses = pending?.hunkStatuses ?? {};

  const showThinking =
    isStreaming &&
    !message.content &&
    !message.tokenBuffer &&
    (!message.steps || message.steps.length === 0);

  const approvedHunkCount = useMemo(() => {
    if (!pending) return 0;
    const allHunks = pending.diffs.flatMap((d) => buildFileDiffWithHunks(d).hunks);
    return allHunks.filter((h) => (hunkStatuses[h.id] ?? "approved") === "approved").length;
  }, [pending, hunkStatuses]);

  if (isUser) {
    return (
      <div className="flex justify-end animate-v-fade-in">
        <div className="flex items-start gap-2 max-w-[80%]">
          <div className="rounded-xl bg-v-accent/10 border border-v-accent/20 px-4 py-2.5 text-sm text-v-text whitespace-pre-wrap break-words">
            {message.content}
          </div>
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-v-accent/15 mt-0.5">
            <User size={14} className="text-v-accent" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-v-fade-in">
      <div className="flex items-start gap-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-v-bg2 border border-v-border mt-0.5">
          <Bot size={14} className="text-v-text2" />
        </div>

        <div className="flex-1 min-w-0 space-y-3">
          {/* Phase indicator */}
          {isStreaming && message.streamingPhase && PHASE_LABEL[message.streamingPhase] && (
            <div className="text-2xs font-medium uppercase tracking-wider text-v-accent">
              {PHASE_LABEL[message.streamingPhase]}
            </div>
          )}

          {/* Thinking dots */}
          {showThinking && <ThinkingIndicator phase={message.streamingPhase} />}

          {/* Plan display */}
          {message.planSteps && message.planSteps.length > 0 && (
            <PlanDisplay steps={message.planSteps} />
          )}

          {/* Execution timeline */}
          {message.steps && message.steps.length > 0 && (
            <StepTimeline steps={message.steps} />
          )}

          {/* Explored files */}
          {message.exploredFiles && message.exploredFiles.length > 0 && (
            <FileExploration
              files={message.exploredFiles}
              counts={message.exploredCounts}
            />
          )}

          {/* Streaming token buffer with blinking cursor */}
          {message.tokenBuffer && (
            <div className="text-sm text-v-text whitespace-pre-wrap break-words leading-relaxed">
              {message.tokenBuffer}
              {isStreaming && (
                <span className="inline-block w-[2px] h-[1.1em] ml-0.5 bg-v-accent align-text-bottom animate-v-blink" />
              )}
            </div>
          )}

          {/* Final content */}
          {message.content && !message.tokenBuffer && (
            <div className="text-sm text-v-text whitespace-pre-wrap break-words leading-relaxed">
              {message.content}
              {isStreaming && !message.tokenBuffer && (
                <span className="inline-block w-[2px] h-[1.1em] ml-0.5 bg-v-accent align-text-bottom animate-v-blink" />
              )}
            </div>
          )}

          {/* Inline diff viewer — pending patch */}
          {pending && (
            <div className="space-y-3">
              {pending.status === "pending" && (
                <>
                  <div className="text-xs font-medium text-v-warning">
                    Generated changes — review per hunk, then apply.
                  </div>
                  <InlineDiffViewer
                    diffs={pending.diffs}
                    hunkStatuses={hunkStatuses}
                    onHunkAccept={(hunkId) => onHunkAccept?.(message.id, hunkId)}
                    onHunkReject={(hunkId) => onHunkReject?.(message.id, hunkId)}
                    onFileAcceptAll={(file) => onFileAcceptAll?.(message.id, file)}
                    onFileRejectAll={(file) => onFileRejectAll?.(message.id, file)}
                  />
                  <div className="flex flex-wrap gap-2 justify-end items-center">
                    <button
                      type="button"
                      className="v-press px-2.5 py-1.5 rounded-lg text-xs font-medium border border-v-border text-v-text2 hover:bg-white/[0.04] hover:text-v-text transition-colors"
                      onClick={() => onIncludeAll?.(message.id)}
                      title="Include every hunk"
                    >
                      Include all
                    </button>
                    <button
                      type="button"
                      className={`v-press px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        approvedHunkCount > 0
                          ? "bg-v-success text-black hover:bg-v-success/90"
                          : "bg-v-bg2 text-v-text3 cursor-not-allowed"
                      }`}
                      disabled={approvedHunkCount === 0}
                      onClick={() => onApplySelected?.(message.id)}
                    >
                      Apply selected
                      {approvedHunkCount > 0 ? ` (${approvedHunkCount})` : ""}
                    </button>
                    <button
                      type="button"
                      className="v-press px-3 py-1.5 rounded-lg text-xs font-medium border border-v-border text-v-text2 hover:bg-v-error/10 hover:text-v-error hover:border-v-error/30 transition-colors"
                      onClick={() => onRejectProposal?.(message.id)}
                    >
                      Reject all
                    </button>
                  </div>
                </>
              )}

              {pending.status === "approved" && (
                <div className="text-xs font-medium text-v-success">
                  {pending.applySummary
                    ? `Applied ${pending.applySummary.applied} file${
                        pending.applySummary.applied !== 1 ? "s" : ""
                      }${
                        pending.applySummary.skipped > 0
                          ? ` (${pending.applySummary.skipped} skipped)`
                          : ""
                      }.`
                    : "Changes applied successfully."}
                </div>
              )}

              {pending.status === "rejected" && (
                <div className="text-xs font-medium text-v-text3">
                  Changes rejected.
                </div>
              )}
            </div>
          )}

          {/* Legacy patch diff view (old-style patches) */}
          {!pending && message.patches && message.patches.length > 0 && (
            <>
              <PatchDiffView patches={message.patches} />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  className="v-press px-3 py-1.5 rounded-lg text-xs font-medium bg-v-success text-black hover:bg-v-success/90 transition-colors"
                  onClick={() => {
                    window.dispatchEvent(
                      new CustomEvent("viper:apply-patch", {
                        detail: { patches: message.patches },
                      }),
                    );
                  }}
                >
                  Apply Changes
                </button>
                <button
                  type="button"
                  className="v-press px-3 py-1.5 rounded-lg text-xs font-medium border border-v-border text-v-text2 hover:bg-white/[0.04] transition-colors"
                >
                  Reject
                </button>
              </div>
            </>
          )}

          {/* Error state */}
          {message.errorMessage && (
            <div className="animate-v-fade-in rounded-lg border border-v-error/30 bg-v-error/[0.06] px-4 py-3 flex items-start gap-3">
              <AlertTriangle size={16} className="shrink-0 text-v-error mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-v-error">{message.errorMessage}</p>
                {onRetry && (
                  <button
                    type="button"
                    className="v-press mt-2 flex items-center gap-1.5 text-xs text-v-text2 hover:text-v-text transition-colors"
                    onClick={() => onRetry(message.id)}
                  >
                    <RotateCcw size={12} />
                    Retry
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
