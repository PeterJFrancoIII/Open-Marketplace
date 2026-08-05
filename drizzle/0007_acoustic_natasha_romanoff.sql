-- Repair path for dirty 0006 databases that already accumulated duplicate
-- public responses per review. Keep the earliest row; quarantine is not
-- required because response text is non-authoritative for trust projections.
DELETE FROM `review_responses`
WHERE `id` NOT IN (
  SELECT MIN(`id`)
  FROM `review_responses`
  GROUP BY `review_id`
);
--> statement-breakpoint
CREATE UNIQUE INDEX `review_responses_one_per_review_idx` ON `review_responses` (`review_id`);
