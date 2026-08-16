CREATE TABLE `conversation_media` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`hash` text NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`size` integer NOT NULL,
	`bytes_base64` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE UNIQUE INDEX `conversation_media_kind_idx` ON `conversation_media` (`conversation_id`,`kind`);--> statement-breakpoint
CREATE INDEX `conversation_media_hash_idx` ON `conversation_media` (`conversation_id`,`hash`);
