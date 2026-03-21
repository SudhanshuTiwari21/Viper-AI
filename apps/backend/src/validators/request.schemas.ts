import { z } from "zod";

export const ChatRequestSchema = z.object({
  prompt: z.string().min(1),
  workspacePath: z.string().min(1),
  conversationId: z.string().min(1).optional(),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1),
      }),
    )
    .max(10)
    .optional(),
});

export const AnalysisRequestSchema = z.object({
  workspacePath: z.string().min(1),
});

export const ContextDebugSchema = z.object({
  prompt: z.string().min(1),
});

export const PatchApplySchema = z.object({
  workspacePath: z.string().min(1),
  /** Echo from patch:preview — server verifies against stored sha256(patch). */
  previewId: z.string().min(1),
  patchHash: z.string().length(64).regex(/^[0-9a-f]+$/),
  patch: z.object({
    changes: z.array(z.object({
      file: z.string(),
      content: z.string(),
    })),
    operations: z.array(z.object({
      file: z.string(),
      type: z.enum(["insert", "replace", "delete"]),
      startLine: z.number(),
      endLine: z.number().optional(),
      content: z.string().optional(),
      expectedOldText: z.string().optional(),
    })),
  }),
});

export const PatchRollbackSchema = z.object({
  workspacePath: z.string().min(1),
  rollbackId: z.string().min(1),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export type AnalysisRequest = z.infer<typeof AnalysisRequestSchema>;
export type ContextDebugRequest = z.infer<typeof ContextDebugSchema>;
export type PatchApplyRequest = z.infer<typeof PatchApplySchema>;
export type PatchRollbackRequest = z.infer<typeof PatchRollbackSchema>;
