export {
  initDatabase,
  getPool,
  closePool,
  type DatabaseConfig,
} from "./database.service";
export { pool } from "./pool";
export { runMigrations } from "./migrate";
export {
  saveRepository,
  type SaveRepositoryParams,
} from "./repository.repository";
export {
  insertRepositoryFiles,
} from "./repository-files.repository";
export type { RepositoryFileRow, RepositoryFileType, RepositoryRow } from "./types";
export {
  insertMemoryEntry,
  getMemoryEntriesBySession,
  getRecentMemoryByWorkspace,
  searchMemoryByKeywords,
  type ConversationMemoryRow,
} from "./conversation-memory.repository";
export {
  upsertConversationModelPreference,
  getConversationModelPreference,
  type ConversationModelTier,
  type ConversationModelPreferenceRow,
} from "./conversation-model-preferences.repository";
export {
  insertChatFeedback,
  getChatFeedbackStats,
  type FeedbackRating,
  type ChatFeedbackRow,
  type FeedbackStats,
} from "./chat-feedback.repository";
export {
  insertChatMedia,
  getChatMedia,
  deleteChatMedia,
  listExpiredChatMedia,
  type ChatMediaRow,
} from "./chat-media.repository";
// F.29: auth core — users, workspaces, workspace_memberships
export {
  createUser,
  getUserByEmail,
  getUserById,
  getUserByExternalSubject,
  updateUser,
  deleteUser,
  toPublicUser,
  type UserRow,
  type CreateUserParams,
  type UpdateUserParams,
  type AuthProvider,
} from "./auth-users.repository";
export {
  insertRefreshToken,
  getRefreshTokenByHash,
  revokeRefreshToken,
  revokeAllRefreshTokensForUser,
  type AuthRefreshTokenRow,
} from "./auth-refresh-tokens.repository";
export {
  insertOAuthState,
  consumeOAuthState,
  insertOAuthExchangeCode,
  consumeOAuthExchangeCode,
} from "./auth-oauth-tables.repository";
export {
  insertEmailVerificationToken,
  consumeEmailVerificationToken,
  markUserEmailVerified,
} from "./auth-email-verification.repository";
export {
  createWorkspace,
  getWorkspaceById,
  getWorkspaceBySlug,
  getWorkspaceByPathKey,
  upsertWorkspaceByPathKey,
  updateWorkspace,
  deleteWorkspace,
  type WorkspaceRow,
  type CreateWorkspaceParams,
  type UpdateWorkspaceParams,
} from "./auth-workspaces.repository";
export {
  upsertWorkspaceEntitlements,
  getWorkspaceEntitlements,
  deleteWorkspaceEntitlements,
  type WorkspaceEntitlementRow,
  type UpsertEntitlementsParams,
} from "./auth-entitlements.repository";
export {
  insertUsageEvent,
  getUsageEventByRequestId,
  countUsageEventsForDay,
  sumCostUnitsForWorkspaceMonth,
  type UsageEventRow,
  type InsertUsageEventParams,
  type UsageBillingBucket,
} from "./usage-events.repository";
export {
  insertWebhookEventIfNew,
  updateWebhookEventStatus,
  getWebhookEvent,
  type BillingWebhookEventRow,
  type InsertWebhookEventParams,
  type WebhookProcessingStatus,
} from "./billing-webhook-events.repository";
export {
  aggregateUsageEventsDaily,
  getRollupForWorkspaceDay,
  listRollupsForWorkspace,
  getAggregationCursor,
  advanceAggregationCursor,
  resolveAggregationWindow,
  type UsageRollupDailyRow,
  type AggregationCursorRow,
  type AggregationRangeParams,
  type AggregationResult,
} from "./usage-rollups.repository";
export {
  upsertMembership,
  getMembership,
  listMembersForWorkspace,
  listWorkspacesForUser,
  removeMembership,
  type WorkspaceMembershipRow,
  type MembershipRole,
} from "./auth-memberships.repository";
