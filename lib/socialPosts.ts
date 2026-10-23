// Shared rules for the Facebook posts on Social Posts (bld.social_posts, written by beyond-line-dance-webhooks).

/**
 * Finished posts can be cleared off the page. Cleared posts are hidden (archivedAt), not deleted: the
 * poster finds a class's post by its key, so deleting one could get the same class drafted and posted again.
 */
export const FINISHED_STATUSES = ["published", "skipped", "expired"];
