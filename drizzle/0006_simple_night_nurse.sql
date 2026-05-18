ALTER TABLE `seasons` ADD `seasonNumber` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `seasons` ADD `totalDays` int DEFAULT 13 NOT NULL;--> statement-breakpoint
CREATE INDEX `seasons_number_idx` ON `seasons` (`seasonNumber`);