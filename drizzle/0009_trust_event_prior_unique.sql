-- Safely enforce one successor per (subject, prior_event_id) and non-null priors.
-- NEVER mutate prior_event_hash: it is covered by existing signatures (0008 payload-hash
-- linkage). Add prior_event_id as separate envelope linkage for UNIQUE + tip walks.
-- Quarantine forks, normalize genesis NULL→'', derive prior_event_id, recreate table.

CREATE TABLE IF NOT EXISTS `trust_events_quarantine` (
	`id` text PRIMARY KEY NOT NULL,
	`subject_profile_id` text NOT NULL,
	`actor_profile_id` text,
	`event_type` text NOT NULL,
	`occurred_at` text NOT NULL,
	`payload_hash` text NOT NULL,
	`prior_event_hash` text,
	`registry_id` text NOT NULL,
	`schema_version` integer NOT NULL,
	`signature` text NOT NULL,
	`quarantined_at` text NOT NULL,
	`quarantine_reason` text NOT NULL
);
--> statement-breakpoint
-- Keep the chronologically earliest row per (subject, prior); quarantine the rest.
INSERT INTO `trust_events_quarantine` (
	`id`, `subject_profile_id`, `actor_profile_id`, `event_type`, `occurred_at`,
	`payload_hash`, `prior_event_hash`, `registry_id`, `schema_version`, `signature`,
	`quarantined_at`, `quarantine_reason`
)
SELECT
	r.`id`,
	r.`subject_profile_id`,
	r.`actor_profile_id`,
	r.`event_type`,
	r.`occurred_at`,
	r.`payload_hash`,
	r.`prior_event_hash`,
	r.`registry_id`,
	r.`schema_version`,
	r.`signature`,
	CURRENT_TIMESTAMP,
	'duplicate_subject_prior_fork'
FROM `trust_events` r
WHERE EXISTS (
	SELECT 1
	FROM `trust_events` k
	WHERE k.`subject_profile_id` = r.`subject_profile_id`
	  AND IFNULL(k.`prior_event_hash`, '') = IFNULL(r.`prior_event_hash`, '')
	  AND (
		k.`occurred_at` < r.`occurred_at`
		OR (k.`occurred_at` = r.`occurred_at` AND k.`id` < r.`id`)
	  )
);
--> statement-breakpoint
DELETE FROM `trust_events`
WHERE `id` IN (SELECT `id` FROM `trust_events_quarantine`);
--> statement-breakpoint
-- Normalize genesis sentinel only (NULL → ''); never rewrite non-empty signed priors.
UPDATE `trust_events` SET `prior_event_hash` = '' WHERE `prior_event_hash` IS NULL;
--> statement-breakpoint
CREATE TABLE `trust_events_new` (
	`id` text PRIMARY KEY NOT NULL,
	`subject_profile_id` text NOT NULL,
	`actor_profile_id` text,
	`event_type` text NOT NULL,
	`occurred_at` text NOT NULL,
	`payload_hash` text NOT NULL,
	`prior_event_hash` text DEFAULT '' NOT NULL,
	`prior_event_id` text DEFAULT '' NOT NULL,
	`registry_id` text NOT NULL,
	`schema_version` integer DEFAULT 1 NOT NULL,
	`signature` text NOT NULL,
	FOREIGN KEY (`subject_profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
-- Preserve signed prior_event_hash bytes; derive prior_event_id chronologically.
INSERT INTO `trust_events_new` (
	`id`, `subject_profile_id`, `actor_profile_id`, `event_type`, `occurred_at`,
	`payload_hash`, `prior_event_hash`, `prior_event_id`, `registry_id`, `schema_version`, `signature`
)
SELECT
	t.`id`,
	t.`subject_profile_id`,
	t.`actor_profile_id`,
	t.`event_type`,
	t.`occurred_at`,
	t.`payload_hash`,
	IFNULL(t.`prior_event_hash`, ''),
	COALESCE((
		SELECT p.`id`
		FROM `trust_events` p
		WHERE p.`subject_profile_id` = t.`subject_profile_id`
		  AND (
			p.`occurred_at` < t.`occurred_at`
			OR (p.`occurred_at` = t.`occurred_at` AND p.`id` < t.`id`)
		  )
		ORDER BY p.`occurred_at` DESC, p.`id` DESC
		LIMIT 1
	), ''),
	t.`registry_id`,
	t.`schema_version`,
	t.`signature`
FROM `trust_events` t;
--> statement-breakpoint
DROP TABLE `trust_events`;
--> statement-breakpoint
ALTER TABLE `trust_events_new` RENAME TO `trust_events`;
--> statement-breakpoint
CREATE INDEX `trust_events_subject_idx` ON `trust_events` (`subject_profile_id`,`occurred_at`);
--> statement-breakpoint
CREATE UNIQUE INDEX `trust_events_subject_prior_uidx` ON `trust_events` (`subject_profile_id`,`prior_event_id`);
