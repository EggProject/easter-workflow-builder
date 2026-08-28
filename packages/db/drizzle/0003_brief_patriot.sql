CREATE TABLE `workflow_run` (
	`id` text PRIMARY KEY NOT NULL,
	`workflow_id` text NOT NULL,
	`status` text NOT NULL,
	`input` text NOT NULL,
	`provider_id` text NOT NULL,
	`root_run_id` text NOT NULL,
	`depth` integer NOT NULL,
	`workflow_ancestry` text NOT NULL,
	`graph_snapshot_hash` text NOT NULL,
	`persisted_stream_deltas` integer NOT NULL,
	`restarted_from_run_id` text,
	`created_at_ms` integer NOT NULL,
	`started_at_ms` integer,
	`finished_at_ms` integer,
	`error_kind` text,
	`error_message` text,
	FOREIGN KEY (`workflow_id`) REFERENCES `workflow`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`root_run_id`) REFERENCES `workflow_run`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`graph_snapshot_hash`) REFERENCES `graph_snapshot`(`hash`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`restarted_from_run_id`) REFERENCES `workflow_run`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `workflow_run_workflow_created_idx` ON `workflow_run` (`workflow_id`,`created_at_ms`);--> statement-breakpoint
CREATE INDEX `workflow_run_status_idx` ON `workflow_run` (`status`);--> statement-breakpoint
CREATE INDEX `workflow_run_root_idx` ON `workflow_run` (`root_run_id`);--> statement-breakpoint
CREATE INDEX `workflow_run_snapshot_idx` ON `workflow_run` (`graph_snapshot_hash`);