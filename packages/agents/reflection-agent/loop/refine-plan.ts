import type { ExecutionPlan, PlanStep, PlanStepType } from "@repo/planner-agent";
import type { ReflectionResult } from "../reflection/reflection.types";

/**
 * Apply reflection adjustments to produce a refined execution plan.
 *
 * Adjustments are applied in order: removes first, then replaces, then adds.
 * Step IDs are regenerated to avoid collisions with previous iterations.
 */
export function refinePlan(
  plan: ExecutionPlan,
  reflection: ReflectionResult,
): ExecutionPlan {
  let steps = [...plan.steps];

  const removes = reflection.planAdjustments.filter((a) => a.action === "remove");
  const replaces = reflection.planAdjustments.filter((a) => a.action === "replace");
  const adds = reflection.planAdjustments.filter((a) => a.action === "add");

  for (const rm of removes) {
    if (rm.targetStepType) {
      steps = steps.filter((s) => s.type !== rm.targetStepType);
    }
  }

  const stepTypesPresent = () => new Set(steps.map((s) => s.type));

  for (const rp of replaces) {
    if (rp.targetStepType && rp.newStepType) {
      const types = stepTypesPresent();
      if (rp.newStepType === "SEARCH_EMBEDDING" && types.has("SEARCH_EMBEDDING")) {
        continue;
      }
      steps = steps.map((s) => {
        if (s.type !== rp.targetStepType) return s;
        return {
          ...s,
          type: rp.newStepType as PlanStepType,
          description: `${rp.reason} (refined from ${s.type})`,
        };
      });
    }
  }

  for (const add of adds) {
    if (add.newStepType) {
      const alreadyExists = steps.some((s) => s.type === add.newStepType);
      if (!alreadyExists) {
        const insertBefore = steps.findIndex((s) => s.type === "GENERATE_PATCH");
        const newStep: PlanStep = {
          id: `refined-${steps.length}-${add.newStepType}`,
          type: add.newStepType as PlanStepType,
          description: add.reason,
          entities: plan.steps[0]?.entities,
        };

        if (insertBefore >= 0) {
          steps.splice(insertBefore, 0, newStep);
        } else {
          steps.push(newStep);
        }
      }
    }
  }

  steps = steps.map((s, idx) => ({
    ...s,
    id: `${idx}-${s.type}`,
  }));

  return { intent: plan.intent, steps };
}
