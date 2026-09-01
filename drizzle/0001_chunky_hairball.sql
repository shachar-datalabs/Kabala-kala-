CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text,
	`outcome` text NOT NULL,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_audit_owner_created` ON `audit_logs` (`owner_user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `businesses` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`business_name` text DEFAULT '' NOT NULL,
	`owner_name` text DEFAULT '' NOT NULL,
	`business_number` text,
	`email` text,
	`phone` text,
	`address` text,
	`tax_year` integer,
	`exempt_dealer_ceiling_agorot` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_businesses_owner` ON `businesses` (`owner_user_id`);--> statement-breakpoint
CREATE TABLE `clients` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`name` text NOT NULL,
	`business_number` text,
	`identity_number` text,
	`email` text,
	`phone` text,
	`address` text,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_clients_owner_name` ON `clients` (`owner_user_id`,`name`);--> statement-breakpoint
CREATE INDEX `idx_clients_owner_active` ON `clients` (`owner_user_id`,`deleted_at`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`document_id` text NOT NULL,
	`payment_date` text NOT NULL,
	`amount_agorot` integer NOT NULL,
	`payment_method` text NOT NULL,
	`transaction_type` text NOT NULL,
	`bank` text,
	`branch` text,
	`account` text,
	`reference` text,
	`notes` text,
	`card_type` text,
	`card_last_four` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `business_documents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_payments_owner_document` ON `payments` (`owner_user_id`,`document_id`);--> statement-breakpoint
CREATE INDEX `idx_payments_owner_date` ON `payments` (`owner_user_id`,`payment_date`);--> statement-breakpoint
ALTER TABLE `business_documents` ADD `client_id` text REFERENCES clients(id);--> statement-breakpoint
ALTER TABLE `business_documents` ADD `currency` text DEFAULT 'ILS' NOT NULL;--> statement-breakpoint
ALTER TABLE `business_documents` ADD `payment_date` text;--> statement-breakpoint
ALTER TABLE `business_documents` ADD `transaction_type` text;--> statement-breakpoint
ALTER TABLE `business_documents` ADD `notes` text;--> statement-breakpoint
CREATE INDEX `idx_documents_owner_client` ON `business_documents` (`owner_user_id`,`client_id`);