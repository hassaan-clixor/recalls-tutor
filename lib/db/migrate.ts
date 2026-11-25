import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Database } from './client';
export const MIGRATIONS=['001_foundation','002_auth','003_studio','004_practice','005_ai_studio','006_catalogue_papers_trials','007_protection','008_seo','009_billing','010_student','011_ocr','012_partners','013_coupons','014_lifecycle','015_predictor','016_review','017_ai_proposals','018_content','019_phase3','020_question_type','021_duplicate_evidence','022_llm_cooldowns','023_webhook_claims','024_llm_rate_limits','025_attempt_blueprint','026_studio_worker_token','027_duplicate_replace','028_semantic_evidence','029_question_import','030_checkout_coordination','031_text_batches','032_ghl','033_job_warning','034_uploads','035_recalls_best','036_push'];
export async function migrate(db: Database) {
  await db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  await db.transaction(async tx => {
    await tx.query('SELECT pg_advisory_xact_lock(17948301)');
    for (const version of MIGRATIONS) {
      const applied = await tx.query('SELECT version FROM schema_migrations WHERE version=$1', [version]);
      if (applied.length) continue;
      await tx.exec(await readFile(path.join(process.cwd(), `lib/db/${version}.sql`), 'utf8'));
      await tx.query('INSERT INTO schema_migrations(version) VALUES ($1)', [version]);
    }
  });
}
