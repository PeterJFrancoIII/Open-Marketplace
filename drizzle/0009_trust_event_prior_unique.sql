-- Prevent concurrent hash-chain forks: at most one event per (subject, prior).
-- Genesis events use empty-string prior_event_hash instead of NULL (SQLite UNIQUE allows multiple NULLs).
UPDATE trust_events SET prior_event_hash = '' WHERE prior_event_hash IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX `trust_events_subject_prior_uidx` ON `trust_events` (`subject_profile_id`,`prior_event_hash`);
