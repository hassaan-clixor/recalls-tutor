-- UPL-1: batches of large uploads (PRD 4.1, up to 500 MB). Files go straight to private object storage and are processed
-- one at a time by a worker. The stored object is deleted when its file is processed; failed or abandoned objects expire.
CREATE TABLE studio_upload_batches (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_by uuid NOT NULL REFERENCES app_users(id), request_id uuid NOT NULL,
 exam_id uuid NOT NULL REFERENCES exams(id), source_label text NOT NULL, sitting_hint text, sitting_id uuid REFERENCES sittings(id),
 total_bytes bigint NOT NULL CHECK(total_bytes>0), file_count integer NOT NULL CHECK(file_count>0),
 finished_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(created_by,request_id)
);
CREATE TABLE studio_uploads (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), batch_id uuid NOT NULL REFERENCES studio_upload_batches(id) ON DELETE CASCADE,
 file_name text NOT NULL, declared_bytes bigint NOT NULL CHECK(declared_bytes>0), storage_key text NOT NULL UNIQUE,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','uploaded','queued','processing','done','failed','expired')),
 attempts integer NOT NULL DEFAULT 0, error text, job_ids jsonb NOT NULL DEFAULT '[]', lease_until timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), processed_at timestamptz
);
CREATE INDEX studio_upload_work ON studio_uploads(created_at) WHERE status IN ('queued','processing');
