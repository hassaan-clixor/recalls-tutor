ALTER TABLE duplicate_decisions DROP CONSTRAINT duplicate_decisions_decision_check;
ALTER TABLE duplicate_decisions ADD CONSTRAINT duplicate_decisions_decision_check CHECK(decision IN ('merge','keep_both','replace'));
ALTER TABLE question_proposals ADD COLUMN source_question_id uuid REFERENCES questions(id);
ALTER TABLE question_proposals ADD COLUMN source_version_id uuid REFERENCES question_versions(id);
ALTER TABLE question_proposals ADD CONSTRAINT proposal_source_pair CHECK ((source_question_id IS NULL)=(source_version_id IS NULL));
