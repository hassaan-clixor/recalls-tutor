-- Shared across application instances. No prompt, output or provider credential is stored.
CREATE TABLE llm_model_cooldowns (
 model_name text PRIMARY KEY,
 unavailable_until timestamptz NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now()
);
