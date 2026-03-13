export interface ContextRequest {
  symbolSearch?: string[];
  fileSearch?: string[];
  moduleSearch?: string[];
  embeddingSearch?: string[];
  dependencyLookup?: boolean;
}
