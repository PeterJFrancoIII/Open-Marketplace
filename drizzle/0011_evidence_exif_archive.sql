ALTER TABLE `conversation_media` ADD `slot` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `conversation_media` ADD `exif_json` text;--> statement-breakpoint
ALTER TABLE `conversation_media` ADD `quality` text DEFAULT 'full' NOT NULL;--> statement-breakpoint
ALTER TABLE `conversation_media` ADD `width` integer;--> statement-breakpoint
ALTER TABLE `conversation_media` ADD `height` integer;--> statement-breakpoint
ALTER TABLE `conversations` ADD `evidence_archived_at` text;--> statement-breakpoint
ALTER TABLE `listings` ADD `archived_at` text;--> statement-breakpoint
DROP INDEX `conversation_media_kind_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX `conversation_media_kind_slot_idx` ON `conversation_media` (`conversation_id`,`kind`,`slot`);
