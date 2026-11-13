import { Migration } from "@mikro-orm/migrations"

export class Migration20261113000100 extends Migration {
  up(): void {
    this.addSql(`create table if not exists "terminal_booking" (
      "id" text not null, "fulfillment_id" text not null, "order_id" text not null, "environment" text not null,
      "state" text not null, "shipment_id" text null, "result" jsonb null, "last_error" text null,
      "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(),
      "deleted_at" timestamptz null, constraint "terminal_booking_pkey" primary key ("id")
    );`)
    // Keep the key unique even if a ledger row is soft-deleted: deletion must not buy another label.
    this.addSql('create unique index if not exists "terminal_booking_fulfillment_id_unique" on "terminal_booking" ("fulfillment_id");')
  }
  down(): void { this.addSql('drop table if exists "terminal_booking";') }
}
