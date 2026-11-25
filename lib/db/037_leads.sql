-- Email sign-ups from the public exam pages (PRD 9.3). Marketing use needs the consent the visitor ticked.
CREATE TABLE leads (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 email text NOT NULL CHECK(length(email) BETWEEN 5 AND 254),
 exam_slug text NOT NULL CHECK(length(exam_slug) BETWEEN 1 AND 120),
 marketing_consent boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(email,exam_slug)
);
