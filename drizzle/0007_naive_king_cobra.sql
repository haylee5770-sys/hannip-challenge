CREATE TABLE `waters` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`recordedDate` date NOT NULL,
	`recordedAt` timestamp NOT NULL DEFAULT (now()),
	`volumeMl` int NOT NULL,
	`photoKey` varchar(512) NOT NULL,
	`photoUrl` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `waters_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `meals` MODIFY COLUMN `category` enum('breakfast','lunch','dinner','snack','regular','smoothie') NOT NULL;--> statement-breakpoint
CREATE INDEX `waters_user_date_idx` ON `waters` (`userId`,`recordedDate`);