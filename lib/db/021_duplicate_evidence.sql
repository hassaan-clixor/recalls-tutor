-- Preserve the original source row and draft while linking its evidence to a confirmed match.
CREATE TABLE question_extra_evidence (
 target_question_id uuid NOT NULL REFERENCES questions(id),
 source_question_id uuid NOT NULL UNIQUE REFERENCES questions(id),
 source_id uuid NOT NULL REFERENCES recall_sources(id),
 decided_by uuid NOT NULL REFERENCES app_users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(target_question_id,source_question_id),
 CHECK(target_question_id<>source_question_id)
);
CREATE TABLE duplicate_decisions (
 source_question_id uuid NOT NULL REFERENCES questions(id),
 source_version_id uuid NOT NULL REFERENCES question_versions(id),
 target_question_id uuid NOT NULL REFERENCES questions(id),
 target_version_id uuid NOT NULL REFERENCES question_versions(id),
 decision text NOT NULL CHECK(decision IN ('merge','keep_both')),
 decided_by uuid NOT NULL REFERENCES app_users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(source_question_id,source_version_id),
 CHECK(source_question_id<>target_question_id)
);
