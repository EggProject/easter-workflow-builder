CREATE TABLE `human_approval` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`step_run_id` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`payload` text NOT NULL,
	`decision` text,
	`requested_at_ms` integer NOT NULL,
	`decided_at_ms` integer,
	FOREIGN KEY (`run_id`) REFERENCES `workflow_run`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`step_run_id`) REFERENCES `step_run`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `human_approval_step_uq` ON `human_approval` (`step_run_id`);--> statement-breakpoint
CREATE INDEX `human_approval_pending_idx` ON `human_approval` (`decision`,`requested_at_ms`);