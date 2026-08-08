CREATE TABLE `appeals` (
	`id` text PRIMARY KEY NOT NULL,
	`moderation_action_id` text NOT NULL,
	`appellant_id` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`statement` text NOT NULL,
	`decision_public` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`resolved_at` text,
	FOREIGN KEY (`moderation_action_id`) REFERENCES `moderation_actions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`appellant_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `appeals_action_idx` ON `appeals` (`moderation_action_id`);--> statement-breakpoint
CREATE TABLE `disputes` (
	`id` text PRIMARY KEY NOT NULL,
	`transaction_id` text NOT NULL,
	`opened_by` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`reason_code` text NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`resolved_at` text,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`opened_by`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `disputes_tx_idx` ON `disputes` (`transaction_id`);--> statement-breakpoint
CREATE TABLE `moderation_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`subject_profile_id` text NOT NULL,
	`issuer_id` text NOT NULL,
	`action` text NOT NULL,
	`rule_code` text NOT NULL,
	`public_reason` text DEFAULT '' NOT NULL,
	`expires_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`subject_profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `moderation_actions_subject_idx` ON `moderation_actions` (`subject_profile_id`);--> statement-breakpoint
CREATE TABLE `profile_credentials` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`kind` text NOT NULL,
	`assurance_tier` text DEFAULT 'A0' NOT NULL,
	`public_key_json` text,
	`provider` text,
	`provider_subject_hash` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`revoked_at` text,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `profile_credentials_profile_idx` ON `profile_credentials` (`profile_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `profile_credentials_provider_subject_idx` ON `profile_credentials` (`provider`,`provider_subject_hash`);--> statement-breakpoint
CREATE TABLE `review_dimensions` (
	`id` text PRIMARY KEY NOT NULL,
	`review_id` text NOT NULL,
	`dimension` text NOT NULL,
	`score` integer,
	`bool_value` integer,
	`tag` text,
	FOREIGN KEY (`review_id`) REFERENCES `reviews`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `review_dimensions_review_idx` ON `review_dimensions` (`review_id`);--> statement-breakpoint
CREATE TABLE `review_responses` (
	`id` text PRIMARY KEY NOT NULL,
	`review_id` text NOT NULL,
	`author_id` text NOT NULL,
	`kind` text DEFAULT 'public_response' NOT NULL,
	`body` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`review_id`) REFERENCES `reviews`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `review_responses_review_idx` ON `review_responses` (`review_id`);--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`transaction_id` text NOT NULL,
	`reviewer_id` text NOT NULL,
	`subject_id` text NOT NULL,
	`role` text NOT NULL,
	`visibility` text DEFAULT 'sealed' NOT NULL,
	`overall_score` integer NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`revealed_at` text,
	`removed_reason` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reviewer_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subject_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reviews_one_per_tx_reviewer_role_idx` ON `reviews` (`transaction_id`,`reviewer_id`,`role`);--> statement-breakpoint
CREATE INDEX `reviews_subject_idx` ON `reviews` (`subject_id`,`visibility`);--> statement-breakpoint
CREATE TABLE `social_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`provider` text NOT NULL,
	`provider_subject_hash` text,
	`canonical_url` text NOT NULL,
	`handle` text,
	`status` text DEFAULT 'unknown' NOT NULL,
	`account_created_at` text,
	`account_created_at_source` text,
	`connection_count` integer,
	`connection_label` text,
	`connection_count_source` text,
	`verified_at` text,
	`last_checked_at` text,
	`last_successful_refresh_at` text,
	`consecutive_definitive_failures` integer DEFAULT 0 NOT NULL,
	`next_check_at` text,
	`scopes_json` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `social_connections_profile_idx` ON `social_connections` (`profile_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `social_connections_profile_provider_url_idx` ON `social_connections` (`profile_id`,`provider`,`canonical_url`);--> statement-breakpoint
CREATE TABLE `transaction_events` (
	`id` text PRIMARY KEY NOT NULL,
	`transaction_id` text NOT NULL,
	`actor_profile_id` text,
	`event_type` text NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`payload_hash` text NOT NULL,
	`prior_event_hash` text,
	`occurred_at` text NOT NULL,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `transaction_events_tx_idx` ON `transaction_events` (`transaction_id`);--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`listing_id` text NOT NULL,
	`buyer_id` text NOT NULL,
	`seller_id` text NOT NULL,
	`status` text DEFAULT 'proposed' NOT NULL,
	`offer_cents` integer,
	`currency` text DEFAULT 'USD' NOT NULL,
	`completed_at` text,
	`review_deadline_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`buyer_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`seller_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `transactions_buyer_idx` ON `transactions` (`buyer_id`);--> statement-breakpoint
CREATE INDEX `transactions_seller_idx` ON `transactions` (`seller_id`);--> statement-breakpoint
CREATE INDEX `transactions_status_idx` ON `transactions` (`status`);--> statement-breakpoint
CREATE TABLE `trust_events` (
	`id` text PRIMARY KEY NOT NULL,
	`subject_profile_id` text NOT NULL,
	`actor_profile_id` text,
	`event_type` text NOT NULL,
	`occurred_at` text NOT NULL,
	`payload_hash` text NOT NULL,
	`prior_event_hash` text,
	`registry_id` text NOT NULL,
	`schema_version` integer DEFAULT 1 NOT NULL,
	`signature` text NOT NULL,
	FOREIGN KEY (`subject_profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `trust_events_subject_idx` ON `trust_events` (`subject_profile_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `trust_projections` (
	`profile_id` text PRIMARY KEY NOT NULL,
	`projection_version` text NOT NULL,
	`calculated_at` text NOT NULL,
	`last_event_id` text,
	`payload_json` text NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `profiles` ADD `standing` text DEFAULT 'new' NOT NULL;