CREATE TABLE `external_trust_claims` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`source_label` text NOT NULL,
	`issuer` text NOT NULL,
	`claim_type` text NOT NULL,
	`value_json` text NOT NULL,
	`evidence_label` text DEFAULT 'external' NOT NULL,
	`credential_id` text NOT NULL,
	`status` text DEFAULT 'unverified' NOT NULL,
	`valid_from` text NOT NULL,
	`valid_until` text NOT NULL,
	`raw_credential_json` text NOT NULL,
	`imported_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `external_trust_claims_profile_idx` ON `external_trust_claims` (`profile_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `external_trust_claims_credential_idx` ON `external_trust_claims` (`profile_id`,`credential_id`);