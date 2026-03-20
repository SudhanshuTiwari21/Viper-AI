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

export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export type AnalysisRequest = z.infer<typeof AnalysisRequestSchema>;
export type ContextDebugRequest = z.infer<typeof ContextDebugSchema>;
