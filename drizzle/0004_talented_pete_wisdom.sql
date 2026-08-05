CREATE TABLE `oauth_sessions` (
	`state` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`provider` text NOT NULL,
	`code_verifier` text NOT NULL,
	`redirect_uri` text NOT NULL,
	`return_to` text DEFAULT '/' NOT NULL,
	`nonce` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`expires_at` text NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `oauth_sessions_profile_idx` ON `oauth_sessions` (`profile_id`);--> statement-breakpoint
CREATE INDEX `oauth_sessions_expires_idx` ON `oauth_sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `provider_grants` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`social_connection_id` text,
	`provider` text NOT NULL,
	`provider_subject_hash` text NOT NULL,
	`grant_kid` text DEFAULT 'v1' NOT NULL,
	`grant_iv` text DEFAULT '' NOT NULL,
	`grant_ciphertext` text DEFAULT '' NOT NULL,
	`granted_scopes_json` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`expires_at` text,
	`next_refresh_at` text,
	`refresh_backoff_seconds` integer DEFAULT 3600 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`revoked_at` text,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`social_connection_id`) REFERENCES `social_connections`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `provider_grants_profile_idx` ON `provider_grants` (`profile_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `provider_grants_profile_provider_idx` ON `provider_grants` (`profile_id`,`provider`);