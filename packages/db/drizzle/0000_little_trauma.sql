CREATE TABLE `workflow` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`provider_id` text,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `workflow_updated_at_idx` ON `workflow` (`updated_at_ms`);--> statement-breakpoint
CREATE TABLE `workflow_node` (
	`id` text PRIMARY KEY NOT NULL,
	`workflow_id` text NOT NULL,
	`type` text NOT NULL,
	`label` text NOT NULL,
	`position_x` real NOT NULL,
	`position_y` real NOT NULL,
	`config` text NOT NULL,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	FOREIGN KEY (`workflow_id`) REFERENCES `workflow`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `workflow_node_workflow_idx` ON `workflow_node` (`workflow_id`);--> statement-breakpoint
CREATE TABLE `workflow_edge` (
	`id` text PRIMARY KEY NOT NULL,
	`workflow_id` text NOT NULL,
	`source_node_id` text NOT NULL,
	`target_node_id` text NOT NULL,
	`source_handle` text,
	`target_handle` text,
	`branch_key` text,
	`created_at_ms` integer NOT NULL,
	FOREIGN KEY (`workflow_id`) REFERENCES `workflow`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_node_id`) REFERENCES `workflow_node`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_node_id`) REFERENCES `workflow_node`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `workflow_edge_workflow_idx` ON `workflow_edge` (`workflow_id`);--> statement-breakpoint
CREATE INDEX `workflow_edge_source_idx` ON `workflow_edge` (`source_node_id`);--> statement-breakpoint
CREATE INDEX `workflow_edge_target_idx` ON `workflow_edge` (`target_node_id`);