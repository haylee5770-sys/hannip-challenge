CREATE TABLE `sleeps` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`recordedDate` date NOT NULL,
	`bedAt` timestamp NOT NULL,
	`wakeAt` timestamp NOT NULL,
	`durationMinutes` int NOT NULL,
	`bedHour` int NOT NULL,
	`bedMinute` int NOT NULL,
	`wakeHour` int NOT NULL,
	`wakeMinute` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sleeps_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `sleeps_user_date_idx` ON `sleeps` (`userId`,`recordedDate`);