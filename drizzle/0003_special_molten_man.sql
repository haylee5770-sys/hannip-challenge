CREATE TABLE `seasonParticipants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`seasonId` int NOT NULL,
	`userId` int NOT NULL,
	`baselineWeightKg` decimal(5,2),
	`baselineRecordedDate` date,
	`joinedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `seasonParticipants_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `seasons` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`startDate` date NOT NULL,
	`endDate` date NOT NULL,
	`status` enum('upcoming','active','ended') NOT NULL DEFAULT 'active',
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `seasons_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `seasonParticipants_season_user_idx` ON `seasonParticipants` (`seasonId`,`userId`);--> statement-breakpoint
CREATE INDEX `seasons_status_idx` ON `seasons` (`status`);