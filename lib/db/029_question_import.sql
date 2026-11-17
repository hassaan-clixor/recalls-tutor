CREATE TABLE question_imports (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid NOT NULL REFERENCES app_users(id),
 request_id uuid NOT NULL, fingerprint text NOT NULL, question_ids jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(actor_id,request_id)
);
