-- GHL-1..5: GoHighLevel connections and the outbound sync log. A connection belongs to one GHL sub-account
-- (location) and optionally to one exam. The token is stored encrypted (AES-256-GCM); it is never returned to the browser.
CREATE TABLE ghl_connections (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL CHECK(length(name) BETWEEN 2 AND 80),
 location_id text NOT NULL CHECK(location_id ~ '^[A-Za-z0-9]{6,64}$'),
 token_enc text NOT NULL,
 exam_id uuid REFERENCES exams(id),
 enabled boolean NOT NULL DEFAULT true,
 events text[] NOT NULL DEFAULT '{}',
 tag_map jsonb NOT NULL DEFAULT '{}',
 field_map jsonb NOT NULL DEFAULT '{}',
 pipeline_map jsonb NOT NULL DEFAULT '{}',
 created_by uuid REFERENCES app_users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 last_ok_at timestamptz,
 last_error text,
 last_checked_at timestamptz
);
CREATE UNIQUE INDEX ghl_connection_scope ON ghl_connections(location_id,COALESCE(exam_id,'00000000-0000-0000-0000-000000000000'::uuid));
-- One row per event per connection. dedupe_key makes event creation idempotent, so a scan that runs twice never
-- sends a contact the same event twice. Delivery is asynchronous; a GHL outage only delays rows here.
CREATE TABLE ghl_sync_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 connection_id uuid NOT NULL REFERENCES ghl_connections(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES app_users(id),
 exam_id uuid REFERENCES exams(id),
 event text NOT NULL,
 dedupe_key text NOT NULL CHECK(length(dedupe_key)<=300),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','delivered','failed','skipped')),
 attempts integer NOT NULL DEFAULT 0,
 next_attempt_at timestamptz DEFAULT now(),
 last_error text,
 last_status integer,
 ghl_contact_id text,
 created_at timestamptz NOT NULL DEFAULT now(),
 delivered_at timestamptz,
 UNIQUE(connection_id,dedupe_key)
);
CREATE INDEX ghl_sync_due ON ghl_sync_events(next_attempt_at) WHERE status='pending';
CREATE INDEX ghl_sync_recent ON ghl_sync_events(connection_id,created_at DESC);
CREATE INDEX ghl_sync_user ON ghl_sync_events(user_id,created_at DESC);
-- Remembers the last predictor band seen per contact so a band change creates exactly one event.
CREATE TABLE ghl_contact_state (
 connection_id uuid NOT NULL REFERENCES ghl_connections(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES app_users(id),
 exam_id uuid NOT NULL REFERENCES exams(id),
 predictor_band text,
 checked_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(connection_id,user_id,exam_id)
);
