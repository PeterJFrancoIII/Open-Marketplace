CREATE TABLE `listings` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`price_cents` integer NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`condition` text NOT NULL,
	`category` text NOT NULL,
	`location_label` text NOT NULL,
	`distance_miles` real,
	`format` text DEFAULT 'Fixed price' NOT NULL,
	`delivery` text DEFAULT 'Pickup' NOT NULL,
	`seller_id` text NOT NULL,
	`seller_name` text NOT NULL,
	`social_proofs_json` text DEFAULT '[]' NOT NULL,
	`image_manifest_json` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`ending_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `listings_status_created_idx` ON `listings` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `listings_category_price_idx` ON `listings` (`category`,`price_cents`);--> statement-breakpoint
CREATE INDEX `listings_seller_idx` ON `listings` (`seller_id`);--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`listing_id` text NOT NULL,
	`reason` text NOT NULL,
	`details` text DEFAULT '' NOT NULL,
	`reporter_fingerprint` text,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `reports_listing_status_idx` ON `reports` (`listing_id`,`status`);