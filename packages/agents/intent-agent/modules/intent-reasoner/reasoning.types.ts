export interface IntentReasoning {
  detectedComponents: string[];
  missingComponents: string[];
  potentialIssues: string[];
  recommendedNextStep?: string;
}
