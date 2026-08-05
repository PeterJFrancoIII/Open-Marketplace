CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`social_accounts_json` text DEFAULT '[]' NOT NULL,
	`items_sold` integer DEFAULT 0 NOT NULL,
	`seller_rating` real,
	`seller_rating_count` integer DEFAULT 0 NOT NULL,
	`buyer_rating` real,
	`buyer_rating_count` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reputation_ratings` (
	`id` text PRIMARY KEY NOT NULL,
	`listing_id` text NOT NULL,
	`subject_id` text NOT NULL,
	`rater_id` text NOT NULL,
	`role` text NOT NULL,
	`score` integer NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subject_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ratings_one_per_listing_role_idx` ON `reputation_ratings` (`listing_id`,`rater_id`,`role`);--> statement-breakpoint
CREATE INDEX `ratings_subject_role_idx` ON `reputation_ratings` (`subject_id`,`role`);