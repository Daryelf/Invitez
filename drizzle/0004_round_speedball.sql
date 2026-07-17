CREATE TABLE `invitation_sms_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`guest_id` text NOT NULL,
	`provider` text DEFAULT 'twilio' NOT NULL,
	`provider_message_id` text,
	`recipient` text NOT NULL,
	`message_body` text NOT NULL,
	`status` text NOT NULL,
	`error` text,
	`sent_at` text,
	`created_at` text NOT NULL
);
