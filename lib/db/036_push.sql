-- Web push subscriptions (PRD 6.8): one row per browser a student allowed notifications on.
CREATE TABLE push_subscriptions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
 endpoint text NOT NULL UNIQUE CHECK(length(endpoint) BETWEEN 20 AND 1000),
 created_at timestamptz NOT NULL DEFAULT now(),
 last_sent_at timestamptz
);
CREATE INDEX push_subscriptions_user ON push_subscriptions(user_id);
