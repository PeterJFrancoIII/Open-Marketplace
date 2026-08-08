-- Quarantine duplicate public responses before enforcing one-per-review uniqueness.
-- Keep the chronologically earliest row (created_at ASC, id ASC); preserve others in quarantine.
CREATE TABLE IF NOT EXISTS `review_responses_quarantine` (
	`id` text PRIMARY KEY NOT NULL,
	`review_id` text NOT NULL,
	`author_id` text NOT NULL,
	`kind` text DEFAULT 'public_response' NOT NULL,
	`body` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`quarantined_at` text NOT NULL,
	`quarantine_reason` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `review_responses_quarantine` (
	`id`, `review_id`, `author_id`, `kind`, `body`, `created_at`, `quarantined_at`, `quarantine_reason`
)
SELECT
	r.`id`,
	r.`review_id`,
	r.`author_id`,
	r.`kind`,
	r.`body`,
	r.`created_at`,
	datetime('now'),
	'duplicate_response_pre_unique_index'
FROM `review_responses` AS r
WHERE EXISTS (
	SELECT 1
	FROM `review_responses` AS earlier
	WHERE earlier.`review_id` = r.`review_id`
		AND (
			earlier.`created_at` < r.`created_at`
			OR (earlier.`created_at` = r.`created_at` AND earlier.`id` < r.`id`)
		)
);
--> statement-breakpoint
DELETE FROM `review_responses`
WHERE `id` IN (
	SELECT `id` FROM `review_responses_quarantine`
);
--> statement-breakpoint
CREATE UNIQUE INDEX `review_responses_one_per_review_idx` ON `review_responses` (`review_id`);
