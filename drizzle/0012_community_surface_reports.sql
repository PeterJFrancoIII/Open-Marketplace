CREATE TABLE `community_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`title` text NOT NULL,
	`details` text NOT NULL,
	`surface_id` text NOT NULL,
	`surface_label` text NOT NULL,
	`surface_href` text NOT NULL,
	`page_path` text NOT NULL,
	`filter_reason` text,
	`reporter_user_id` text,
	`reporter_fingerprint` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `community_reports_status_created_idx` ON `community_reports` (`status`,`created_at`);
--> statement-breakpoint
CREATE INDEX `community_reports_kind_created_idx` ON `community_reports` (`kind`,`created_at`);
--> statement-breakpoint
CREATE INDEX `community_reports_surface_idx` ON `community_reports` (`surface_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `community_reports_fingerprint_created_idx` ON `community_reports` (`reporter_fingerprint`,`created_at`);
