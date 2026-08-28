CREATE TABLE `run_event` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`run_id` text NOT NULL,
	`step_run_id` text,
	`origin` text NOT NULL,
	`kind` text NOT NULL,
	`occurred_at_ms` integer NOT NULL,
	`sdk_message_type` text,
	`sdk_message_subtype` text,
	`sdk_session_id` text,
	`sdk_uuid` text,
	`parent_tool_use_id` text,
	`tool_name` text,
	`tool_use_id` text,
	`input_tokens` integer,
	`output_tokens` integer,
	`cache_read_input_tokens` integer,
	`cache_creation_input_tokens` integer,
	`num_turns` integer,
	`payload` text NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `workflow_run`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`step_run_id`) REFERENCES `step_run`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `run_event_run_id_idx` ON `run_event` (`run_id`,`id`);--> statement-breakpoint
CREATE INDEX `run_event_step_run_id_idx` ON `run_event` (`step_run_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `run_event_run_uuid_uq` ON `run_event` (`run_id`,`sdk_uuid`);