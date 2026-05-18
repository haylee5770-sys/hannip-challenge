CREATE TABLE `seasonPhotos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`seasonId` int NOT NULL,
	`userId` int NOT NULL,
	`dayNumber` int NOT NULL,
	`slot` enum('before','progress','after') NOT NULL,
	`angle` enum('front','side') NOT NULL,
	`photoKey` varchar(512) NOT NULL,
	`photoUrl` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `seasonPhotos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `seasonReports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`seasonId` int NOT NULL,
	`userId` int NOT NULL,
	`baselineWeightKg` decimal(5,2),
	`finalWeightKg` decimal(5,2),
	`lossPercent` decimal(6,3),
	`finalSkeletalMuscleKg` decimal(5,2),
	`finalBodyFatPercent` decimal(5,2),
	`weightCount` int NOT NULL DEFAULT 0,
	`mealCount` int NOT NULL DEFAULT 0,
	`exerciseCount` int NOT NULL DEFAULT 0,
	`totalCount` int NOT NULL DEFAULT 0,
	`participationScore` int NOT NULL DEFAULT 0,
	`completed` boolean NOT NULL DEFAULT false,
	`reflection` text,
	`isPublic` boolean NOT NULL DEFAULT true,
	`generatedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `seasonReports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `seasonPhotos_season_user_idx` ON `seasonPhotos` (`seasonId`,`userId`);--> statement-breakpoint
CREATE INDEX `seasonPhotos_slot_idx` ON `seasonPhotos` (`seasonId`,`userId`,`slot`);--> statement-breakpoint
CREATE INDEX `seasonReports_season_user_idx` ON `seasonReports` (`seasonId`,`userId`);