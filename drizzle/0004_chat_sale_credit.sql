ALTER TABLE `profiles` ADD `social_credit_score` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`listing_id` text NOT NULL,
	`buyer_id` text NOT NULL,
	`seller_id` text NOT NULL,
	`last_message_at` text,
	`buyer_confirmed_at` text,
	`seller_confirmed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `conversations_listing_buyer_idx` ON `conversations` (`listing_id`,`buyer_id`);--> statement-breakpoint
CREATE INDEX `conversations_buyer_idx` ON `conversations` (`buyer_id`);--> statement-breakpoint
CREATE INDEX `conversations_seller_idx` ON `conversations` (`seller_id`);--> statement-breakpoint
CREATE TABLE `conversation_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`sender_id` text NOT NULL,
	`body` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `conversation_messages_thread_idx` ON `conversation_messages` (`conversation_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `sale_history` (
	`id` text PRIMARY KEY NOT NULL,
	`listing_id` text NOT NULL,
	`conversation_id` text NOT NULL,
	`buyer_id` text NOT NULL,
	`seller_id` text NOT NULL,
	`title` text NOT NULL,
	`price_cents` integer NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`sold_at` text NOT NULL,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sale_history_listing_idx` ON `sale_history` (`listing_id`);--> statement-breakpoint
CREATE INDEX `sale_history_buyer_idx` ON `sale_history` (`buyer_id`);--> statement-breakpoint
CREATE INDEX `sale_history_seller_idx` ON `sale_history` (`seller_id`);
