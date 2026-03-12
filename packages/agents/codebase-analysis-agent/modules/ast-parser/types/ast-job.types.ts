/**
 * Job format consumed from Redis queue (produced by Repo Scanner).
 * One job = one file to parse.
 */
export interface ASTParseJob {
  repo: string;
  file: string;
  language: string;
  module: string;
}
