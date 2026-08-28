CREATE TABLE `app_setting` (
	`id` integer PRIMARY KEY NOT NULL,
	`default_provider_id` text,
	`persist_stream_deltas` integer DEFAULT false NOT NULL,
	`updated_at_ms` integer NOT NULL,
	CONSTRAINT "app_setting_id_check" CHECK("app_setting"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE `provider_concurrency_limit` (
	`provider_id` text PRIMARY KEY NOT NULL,
	`max_concurrent_steps` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	CONSTRAINT "provider_concurrency_limit_max_concurrent_steps_check" CHECK("provider_concurrency_limit"."max_concurrent_steps" > 0)
);
