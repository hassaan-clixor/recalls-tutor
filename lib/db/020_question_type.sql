-- Existing records have no verified type; staff classify them explicitly.
ALTER TABLE questions ADD COLUMN question_type text CHECK (question_type IN ('SBA','EMQ','MCQ','TRUE_FALSE'));
