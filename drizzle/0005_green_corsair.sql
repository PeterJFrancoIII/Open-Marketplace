CREATE TABLE `review_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`review_id` text NOT NULL,
	`reporter_id` text NOT NULL,
	`reason_code` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`details` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`resolved_at` text,
	FOREIGN KEY (`review_id`) REFERENCES `reviews`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reporter_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `review_reports_review_idx` ON `review_reports` (`review_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `review_reports_one_per_reporter_idx` ON `review_reports` (`review_id`,`reporter_id`);--> statement-breakpoint
ALTER TABLE `disputes` ADD `resolution_code` text;--> statement-breakpoint
ALTER TABLE `disputes` ADD `public_outcome` text;--> statement-breakpoint
ALTER TABLE `moderation_actions` ADD `status` text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `moderation_actions` ADD `scope_json` text;