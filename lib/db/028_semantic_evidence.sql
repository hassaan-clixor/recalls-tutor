CREATE TABLE semantic_merge_evidence (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 target_question_id uuid NOT NULL REFERENCES questions(id),
 job_id uuid NOT NULL REFERENCES studio_jobs(id),
 draft_index integer NOT NULL CHECK(draft_index>=0),
 source_text text NOT NULL, source_label text NOT NULL,
 embedding_model text NOT NULL, similarity double precision NOT NULL CHECK(similarity BETWEEN -1 AND 1),
 created_by uuid NOT NULL REFERENCES app_users(id), created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(job_id,draft_index)
);
ALTER TABLE studio_jobs ADD COLUMN merged_count integer NOT NULL DEFAULT 0 CHECK(merged_count>=0);
