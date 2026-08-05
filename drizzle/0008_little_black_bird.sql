-- Quarantine duplicate provider subjects before global uniqueness.
-- Keep the chronologically earliest connection per (provider, provider_subject_hash).
CREATE TABLE IF NOT EXISTS `social_connections_quarantine` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`provider` text NOT NULL,
	`provider_subject_hash` text,
	`canonical_url` text NOT NULL,
	`handle` text,
	`status` text NOT NULL,
	`account_created_at` text,
	`verified_at` text,
	`created_at` text,
	`updated_at` text,
	`quarantined_at` text NOT NULL,
	`quarantine_reason` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `social_connections_quarantine` (
	`id`, `profile_id`, `provider`, `provider_subject_hash`, `canonical_url`, `handle`,
	`status`, `account_created_at`, `verified_at`, `created_at`, `updated_at`,
	`quarantined_at`, `quarantine_reason`
)
SELECT
	r.`id`,
	r.`profile_id`,
	r.`provider`,
	r.`provider_subject_hash`,
	r.`canonical_url`,
	r.`handle`,
	r.`status`,
	r.`account_created_at`,
	r.`verified_at`,
	r.`created_at`,
	r.`updated_at`,
	datetime('now'),
	'duplicate_provider_subject_pre_unique_index'
FROM `social_connections` AS r
WHERE r.`provider_subject_hash` IS NOT NULL
	AND EXISTS (
		SELECT 1
		FROM `social_connections` AS earlier
		WHERE earlier.`provider` = r.`provider`
			AND earlier.`provider_subject_hash` = r.`provider_subject_hash`
			AND (
				earlier.`created_at` < r.`created_at`
				OR (earlier.`created_at` = r.`created_at` AND earlier.`id` < r.`id`)
			)
	);
--> statement-breakpoint
DELETE FROM `social_connections`
WHERE `id` IN (
	SELECT `id` FROM `social_connections_quarantine`
);
--> statement-breakpoint
CREATE UNIQUE INDEX `social_connections_provider_subject_idx` ON `social_connections` (`provider`,`provider_subject_hash`);
