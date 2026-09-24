-- db/migrations/2026-09-add-is-emu-to-organizations.sql
--
-- Run this once against the existing (already-created) database
-- to add EMU (Enterprise Managed Users) account detection.
-- db/schema.sql already has this column for fresh installs; this
-- file is only needed to bring an existing database up to date.
--
-- After running this, re-open the dashboard as each connected
-- org's owner (or just load the "Add Organization" list) once so
-- /api/orgs/installed re-derives is_emu from your own login and
-- backfills every existing row -- no manual data entry needed.

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS is_emu BOOLEAN NOT NULL DEFAULT false;
