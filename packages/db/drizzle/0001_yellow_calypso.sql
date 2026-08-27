CREATE TABLE `graph_snapshot` (
	`hash` text PRIMARY KEY NOT NULL,
	`document_version` integer NOT NULL,
	`document` text NOT NULL,
	`first_captured_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `graph_snapshot_version_idx` ON `graph_snapshot` (`document_version`);