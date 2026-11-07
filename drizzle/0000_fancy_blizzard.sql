CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`incident_id` text NOT NULL,
	`kind` text NOT NULL,
	`content` text NOT NULL,
	`outcome` text,
	`author` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`incident_id`) REFERENCES `incidents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `events_incident_idx` ON `events` (`incident_id`);--> statement-breakpoint
CREATE TABLE `incidents` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`service` text NOT NULL,
	`environment` text NOT NULL,
	`severity` text NOT NULL,
	`status` text NOT NULL,
	`description` text NOT NULL,
	`logs` text NOT NULL,
	`owner` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`resolution` text,
	`source_key` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`resolved_at` text
);
--> statement-breakpoint
CREATE INDEX `incidents_updated_idx` ON `incidents` (`updated_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `incidents_source_idx` ON `incidents` (`source_key`);--> statement-breakpoint
CREATE TABLE `investigations` (
	`id` text PRIMARY KEY NOT NULL,
	`incident_id` text NOT NULL,
	`revision` integer NOT NULL,
	`result` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`incident_id`) REFERENCES `incidents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `investigations_incident_idx` ON `investigations` (`incident_id`);--> statement-breakpoint
CREATE TABLE `memory_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`incident_id` text NOT NULL,
	`revision` integer NOT NULL,
	`document_id` text NOT NULL,
	`content` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`incident_id`) REFERENCES `incidents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `jobs_revision_idx` ON `memory_jobs` (`incident_id`,`revision`);