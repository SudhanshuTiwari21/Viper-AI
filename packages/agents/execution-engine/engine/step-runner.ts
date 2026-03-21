import type { PlanStep } from "@repo/planner-agent";
import type { ContextWindow } from "@repo/context-ranking";
import { TOOL_REGISTRY } from "../tools/tool-registry";
import type { ExecutionContext, StepOutput } from "./execution.types";

export async function runStep(
  step: PlanStep,
  ctx: ExecutionContext,
): Promise<StepOutput> {
  ctx.logs.push(`[Viper] Running step: ${step.type}`);

  const tool = TOOL_REGISTRY[step.type];

  if (!tool) {
    ctx.logs.push(`[Viper] No tool for step: ${step.type} — skipped`);
    return { stepId: step.id, stepType: step.type };
  }

  const output = await tool(
    { type: step.type, entities: step.entities },
    ctx,
  );

  const stepOutput: StepOutput = {
    stepId: step.id,
    stepType: step.type,
    result: output.result as ContextWindow | undefined,
  };

  ctx.intermediateResults.push(stepOutput);

  return stepOutput;
}
