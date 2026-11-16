import { Migration } from "@mikro-orm/migrations"

export class Migration20261116000100 extends Migration {
  up(): void {
    this.addSql(`create table if not exists "custom_request" (
      "id" text not null, "number" serial, "submission_key" text not null,
      "status" text check ("status" in ('new', 'quoted', 'closed')) not null default 'new',
      "name" text not null, "whatsapp" text not null, "email" text null, "description" text not null,
      "country_code" text not null, "city" text not null,
      "hair_type" text check ("hair_type" in ('premium_virgin', 'raw')) null,
      "texture" text null, "length" text null, "budget" text null,
      "quoted_amount" numeric null, "raw_quoted_amount" jsonb null, "quoted_currency" text null,
      "admin_notes" text null,
      "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(),
      "deleted_at" timestamptz null, constraint "custom_request_pkey" primary key ("id")
    );`)
    // References start at YNH-1001 so early customers don't see a suspiciously low number.
    this.addSql(`alter sequence "custom_request_number_seq" restart with 1001;`)
    this.addSql(
      'create unique index if not exists "custom_request_submission_key_unique" on "custom_request" ("submission_key");',
    )
    this.addSql(
      'create index if not exists "custom_request_status_created_at" on "custom_request" ("status", "created_at" desc) where "deleted_at" is null;',
    )
  }

  down(): void {
    this.addSql('drop table if exists "custom_request";')
  }
}
