/**
 * Incoming relationship edge from Metadata Extractor (dependency_graph.build event).
 */
export interface IncomingRelationshipEdge {
  id: string;
  repo_id: string;
  from: string;
  to: string;
  type: string;
  file: string;
  module: string;
}

/**
 * Job consumed from dependency_graph.build channel (published by Metadata Extractor).
 */
export interface GraphBuildJob {
  repo_id: string;
  file: string;
  module: string;
  edges?: IncomingRelationshipEdge[];
  /** Optional: when event includes raw metadata instead of pre-built edges. */
  functions?: Array<{ function: string; file: string; module: string }>;
  classes?: Array<{ class: string; file: string; module: string }>;
  imports?: string[];
  relationships?: IncomingRelationshipEdge[];
}
