import { useMemo } from "react";
import { stripMarkdownForChat } from "../services/agent-api";
import { AlertTriangle, RotateCcw, User, Bot, CheckCircle2, FileEdit, ArrowRight, Square } from "lucide-react";
import type { ChatMessage as ChatMessageType } from "../contexts/chat-context";
import { ThinkingIndicator } from "./thinking-indicator";
import { PlanDisplay } from "./plan-display";
import { StepTimeline } from "./step-timeline";
import { FileExploration } from "./file-exploration";
import { InlineDiffViewer } from "./inline-diff-viewer";
import { PatchDiffView } from "./patch-diff-view";
import { ToolActivity } from "./tool-activity";
import { buildFileDiffWithHunks } from "../lib/hunk-model";
import { useDelayedVisible } from "../hooks/use-delayed-visible";
import { useTokenSmoother } from "../hooks/use-token-smoother";

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
  onContinueStep?: () => void;
  onStopStep?: () => void;
}

const PHASE_LABEL: Record<string, string> = {
  intent: "Planning",
  planning: "Planning",
  indexing: "Indexing workspace",
  executing: "Executing",
  reasoning: "Analyzing",
  generating: "Writing",
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
  onContinueStep,
  onStopStep,
}: ChatMessageProps) {
  const isUser = message.role === "user";
  const isStreaming = message.streaming && message.streamingPhase !== "done";
  const pending = message.pendingPatch;
  const hunkStatuses = pending?.hunkStatuses ?? {};

  const hasPlanData =
    (message.planSteps?.length ?? 0) > 0 || Boolean(message.planNarrativeBuffer?.trim());
  const hasStepsData = (message.steps?.length ?? 0) > 0;
  const planVisible = useDelayedVisible(hasPlanData, 120);
  const stepsVisible = useDelayedVisible(hasStepsData, 150);

  const shouldShowThinking =
    !!isStreaming &&
    !message.content &&
    !message.tokenBuffer &&
    !message.thinkingBuffer &&
    !message.planNarrativeBuffer?.trim() &&
    (!message.steps || message.steps.length === 0) &&
    !hasPlanData;

  const thinkingVisible = useDelayedVisible(shouldShowThinking, 250);
  const diffVisible = useDelayedVisible(!!pending, 300);
  const { text: smoothedTokens, isCatchingUp } = useTokenSmoother(message.tokenBuffer);

  const hasFiles = !!message.exploredFiles && message.exploredFiles.length > 0;
  const hasTokens = !!smoothedTokens;
  const showStreamBlinkCursor =
    isStreaming && hasTokens && !isCatchingUp;

  const approvedHunkCount = useMemo(() => {
    if (!pending) return 0;
    const allHunks = pending.diffs.flatMap((d) => buildFileDiffWithHunks(d).hunks);
    return allHunks.filter((h) => (hunkStatuses[h.id] ?? "approved") === "approved").length;
  }, [pending, hunkStatuses]);

  if (isUser) {
    return (
      <div className="flex justify-end animate-v-slide-up">
        <div className="flex items-start gap-2 max-w-[80%]">
          <div className="rounded-xl bg-v-accent/10 border border-v-accent/20 px-3 py-2 text-sm text-v-text whitespace-pre-wrap break-words">
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
    <div className="animate-v-slide-up">
      <div className="flex items-start gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-v-bg2 border border-v-border mt-0.5">
          <Bot size={14} className="text-v-text2" />
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-3">
          {isStreaming && message.streamingPhase && PHASE_LABEL[message.streamingPhase] && (
            <div className="text-2xs font-medium uppercase tracking-wider text-v-accent animate-v-fade-in">
              {PHASE_LABEL[message.streamingPhase]}
            </div>
          )}

          {thinkingVisible && <ThinkingIndicator phase={message.streamingPhase} />}

          {message.thinkingBuffer && (
            <div className="rounded-lg border border-v-border/60 bg-v-bg2/40 px-3 py-2 text-xs text-v-text2 leading-relaxed whitespace-pre-wrap animate-v-fade-in">
              {stripMarkdownForChat(message.thinkingBuffer)}
            </div>
          )}

          {(message.toolCalls?.length ?? 0) > 0 && (
            <ToolActivity toolCalls={message.toolCalls!} />
          )}

          {planVisible && hasPlanData && (
            <PlanDisplay
              narrative={message.planNarrativeBuffer}
              steps={message.planSteps}
            />
          )}

          {stepsVisible && hasStepsData && (
            <StepTimeline
              steps={message.steps!}
              actionNarration={message.actionNarration}
            />
          )}

          {hasFiles && (
            <div className="animate-v-subtle-pulse">
              <FileExploration
                files={message.exploredFiles!}
                counts={message.exploredCounts}
                phase={message.explorationPhase}
              />
            </div>
          )}

          {hasTokens && (
            <div className="animate-v-fade-in text-sm text-v-text whitespace-pre-wrap break-words leading-relaxed">
              {stripMarkdownForChat(smoothedTokens)}
              {showStreamBlinkCursor && (
                <span className="inline-block w-[2px] h-[1.1em] ml-0.5 bg-v-accent align-text-bottom animate-v-blink" />
              )}
            </div>
          )}

          {message.content && !message.tokenBuffer && (
            <div className="text-sm text-v-text whitespace-pre-wrap break-words leading-relaxed">
              {stripMarkdownForChat(message.content)}
              {isStreaming && !message.tokenBuffer && (
                <span className="inline-block w-[2px] h-[1.1em] ml-0.5 bg-v-accent align-text-bottom animate-v-blink" />
              )}
            </div>
          )}

          {message.awaitingApproval && (
            <div className="animate-v-fade-in rounded-lg border border-v-border/60 bg-v-bg2/50 overflow-hidden">
              <div className="px-3 py-2.5 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-v-success shrink-0" />
                  <span className="text-xs font-medium text-v-text">
                    Step {message.awaitingApproval.stepNumber} completed
                  </span>
                </div>

                {message.awaitingApproval.editedFiles.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pl-[22px]">
                    {message.awaitingApproval.editedFiles.map((f) => (
                      <span
                        key={f}
                        className="inline-flex items-center gap-1 rounded bg-v-bg2 border border-v-border/40 px-1.5 py-0.5 text-2xs font-mono text-v-text3"
                      >
                        <FileEdit size={10} className="shrink-0" />
                        {f}
                      </span>
                    ))}
                  </div>
                )}

                {message.awaitingApproval.summary && (
                  <p className="text-xs text-v-text2 pl-[22px] leading-relaxed">
                    {stripMarkdownForChat(message.awaitingApproval.summary)}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 px-3 py-2 border-t border-v-border/30 bg-v-bg2/30">
                <span className="text-2xs text-v-text3 mr-auto">
                  Should I continue to the next step?
                </span>
                <button
                  type="button"
                  className="v-press flex items-center gap-1 px-2.5 py-1 rounded-md text-2xs font-medium border border-v-border/50 text-v-text2 hover:bg-white/[0.04] hover:text-v-text transition-colors"
                  onClick={() => onStopStep?.()}
                >
                  <Square size={10} className="shrink-0" />
                  Stop
                </button>
                <button
                  type="button"
                  className="v-press flex items-center gap-1 px-2.5 py-1 rounded-md text-2xs font-medium bg-v-accent/15 border border-v-accent/30 text-v-accent hover:bg-v-accent/25 transition-colors"
                  onClick={() => onContinueStep?.()}
                >
                  <ArrowRight size={10} className="shrink-0" />
                  Continue
                </button>
              </div>
            </div>
          )}

          {pending && diffVisible && (
            <div className="animate-v-slide-up flex flex-col gap-3">
              <div className="animate-v-subtle-pulse flex flex-col gap-3">
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
                  <div className="text-xs font-medium text-v-success animate-v-fade-in">
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
                  <div className="text-xs font-medium text-v-text3 animate-v-fade-in">
                    Changes rejected.
                  </div>
                )}
              </div>
            </div>
          )}

          {!pending && message.patches && message.patches.length > 0 && (
            <div className="animate-v-slide-up animate-v-subtle-pulse">
              <PatchDiffView patches={message.patches} />
              <div className="flex gap-2 justify-end mt-3">
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
            </div>
          )}

          {message.errorMessage && (
            <div className="animate-v-slide-up rounded-lg border border-v-error/30 bg-v-error/[0.06] px-3 py-2.5 flex items-start gap-2.5">
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
