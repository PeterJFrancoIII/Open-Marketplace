ALTER TABLE `conversations` ADD `buyer_sale_status` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `conversations` ADD `seller_sale_status` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
UPDATE `conversations` SET `buyer_sale_status` = 'complete' WHERE `buyer_confirmed_at` IS NOT NULL;--> statement-breakpoint
UPDATE `conversations` SET `seller_sale_status` = 'complete' WHERE `seller_confirmed_at` IS NOT NULL;
