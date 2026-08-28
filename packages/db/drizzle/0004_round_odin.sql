CREATE TABLE `step_run` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`node_id` text NOT NULL,
	`node_type` text NOT NULL,
	`parent_step_run_id` text,
	`iteration` integer DEFAULT 0 NOT NULL,
	`attempt` integer DEFAULT 1 NOT NULL,
	`status` text NOT NULL,
	`provider_id` text NOT NULL,
	`model_id` text,
	`session_mode` text,
	`sdk_session_id` text,
	`resumed_from_session_id` text,
	`forked_session` integer DEFAULT false NOT NULL,
	`structured_output_strategy` text,
	`output` text,
	`result_subtype` text,
	`num_turns` integer,
	`input_tokens` integer,
	`output_tokens` integer,
	`cache_read_input_tokens` integer,
	`cache_creation_input_tokens` integer,
	`sub_workflow_run_id` text,
	`error_kind` text,
	`error_message` text,
	`started_at_ms` integer,
	`finished_at_ms` integer,
	`created_at_ms` integer NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `workflow_run`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_step_run_id`) REFERENCES `step_run`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sub_workflow_run_id`) REFERENCES `workflow_run`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `step_run_run_created_idx` ON `step_run` (`run_id`,`created_at_ms`);--> statement-breakpoint
CREATE INDEX `step_run_run_node_idx` ON `step_run` (`run_id`,`node_id`);--> statement-breakpoint
CREATE INDEX `step_run_parent_idx` ON `step_run` (`parent_step_run_id`);--> statement-breakpoint
CREATE INDEX `step_run_sub_run_idx` ON `step_run` (`sub_workflow_run_id`);