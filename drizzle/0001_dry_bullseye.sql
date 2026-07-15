CREATE TABLE `event_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`event_name` text NOT NULL,
	`event_date` text NOT NULL,
	`event_time` text NOT NULL,
	`event_iso` text NOT NULL,
	`venue` text NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`map_url` text DEFAULT '' NOT NULL,
	`day_of_override` integer DEFAULT false NOT NULL,
	`photo_uploads_enabled` integer DEFAULT true NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `invitation_guests` (
	`id` text PRIMARY KEY NOT NULL,
	`invite_token` text NOT NULL,
	`name` text NOT NULL,
	`email` text,
	`phone` text,
	`party_size` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`additional_information` text,
	`sent_at` text,
	`first_opened_at` text,
	`last_opened_at` text,
	`opened_count` integer DEFAULT 0 NOT NULL,
	`responded_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invitation_guests_invite_token_unique` ON `invitation_guests` (`invite_token`);