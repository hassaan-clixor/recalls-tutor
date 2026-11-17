CREATE TABLE studio_text_batches (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_by uuid NOT NULL REFERENCES app_users(id),
 request_id uuid NOT NULL, fingerprint text NOT NULL, job_ids jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(created_by,request_id)
);
