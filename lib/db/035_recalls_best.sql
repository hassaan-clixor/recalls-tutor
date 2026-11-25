-- Best-answer marking on moderated comments, and recalls submitted by students (PRD 6.9).
ALTER TABLE question_comments ADD COLUMN best boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX question_comment_one_best ON question_comments(question_id) WHERE best;
CREATE TABLE student_recalls (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES app_users(id),
 exam_id uuid NOT NULL REFERENCES exams(id),
 sitting_hint text CHECK(sitting_hint IS NULL OR length(sitting_hint)<=80),
 body text NOT NULL CHECK(length(body) BETWEEN 20 AND 8000),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined')),
 reviewed_by uuid REFERENCES app_users(id), reviewed_at timestamptz, credited boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX student_recalls_pending ON student_recalls(created_at) WHERE status='pending';
CREATE INDEX student_recalls_user ON student_recalls(user_id,created_at DESC);
