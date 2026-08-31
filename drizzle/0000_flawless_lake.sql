CREATE TABLE `business_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`customer_name` text NOT NULL,
	`customer_email` text,
	`customer_phone` text,
	`customer_crn` text,
	`document_type` text NOT NULL,
	`amount_agorot` integer NOT NULL,
	`document_date` text NOT NULL,
	`due_date` text,
	`payment_type` integer,
	`payment_details_json` text DEFAULT '{}' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`status` text NOT NULL,
	`ezcount_doc_number` text,
	`ezcount_doc_uuid` text,
	`pdf_link` text,
	`error_message` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_documents_owner_created` ON `business_documents` (`owner_user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_documents_owner_status` ON `business_documents` (`owner_user_id`,`status`);--> statement-breakpoint
PRAGMA optimize;
