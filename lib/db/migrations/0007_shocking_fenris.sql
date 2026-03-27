CREATE TYPE "public"."chat_message_role" AS ENUM('user', 'assistant');--> statement-breakpoint
CREATE TABLE "agent_conversation" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text,
	"model" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_message" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"role" "chat_message_role" NOT NULL,
	"content" text NOT NULL,
	"model" text,
	"tool_calls" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_conversation" ADD CONSTRAINT "agent_conversation_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_message" ADD CONSTRAINT "agent_message_conversation_id_agent_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."agent_conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_conversation_user_id_idx" ON "agent_conversation" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "agent_conversation_updated_at_idx" ON "agent_conversation" USING btree ("updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "agent_message_conversation_id_idx" ON "agent_message" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "agent_message_created_at_idx" ON "agent_message" USING btree ("created_at");