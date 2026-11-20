-- v3.3 — Google Calendar sync: remember the Google event id on each meeting
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS gcal_event_id TEXT;
