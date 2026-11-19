import { Migration } from "@mikro-orm/migrations"

export class Migration20261118000100 extends Migration {
  up(): void {
    this.addSql(`create table if not exists "courier_dispatch" (
      "id" text not null, "order_id" text not null,
      "state" text check ("state" in ('pending', 'creating', 'booked', 'complete', 'failed')) not null default 'pending',
      "carrier" text null, "environment" text null, "fulfillment_id" text null,
      "waybill" text null, "tracking_url" text null,
      "attempts" integer not null default 0, "last_error" text null,
      "next_attempt_at" timestamptz not null default now(),
      "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(),
      "deleted_at" timestamptz null, constraint "courier_dispatch_pkey" primary key ("id")
    );`)
    // Unique even when soft-deleted: re-queueing an order must never purchase a second waybill.
    this.addSql(
      'create unique index if not exists "courier_dispatch_order_id_unique" on "courier_dispatch" ("order_id");',
    )
    this.addSql(
      `create index if not exists "courier_dispatch_due" on "courier_dispatch" ("next_attempt_at") where "state" in ('pending', 'booked') and "deleted_at" is null;`,
    )
  }

  down(): void {
    this.addSql('drop table if exists "courier_dispatch";')
  }
}
