export interface IntentResponse {
  intent: string;
  summary: string;
  relevantFiles?: string[];
  detectedComponents?: string[];
  missingComponents?: string[];
  potentialIssues?: string[];
  recommendedNextStep?: string;
}
