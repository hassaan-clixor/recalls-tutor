CREATE TABLE checkout_reservations (
 user_id uuid NOT NULL REFERENCES app_users(id), exam_id uuid NOT NULL REFERENCES exams(id),
 attempt_id uuid NOT NULL DEFAULT gen_random_uuid(), checkout_input jsonb NOT NULL,
 session_id text, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,exam_id)
);
