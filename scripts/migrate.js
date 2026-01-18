require('dotenv').config({ path: '.env.local' });
const { sql } = require('@vercel/postgres');

async function migrate() {
  try {
    console.log('Starting database migration...');

    await sql`
      CREATE TABLE IF NOT EXISTS user_sessions (
        session_id TEXT PRIMARY KEY,
        encrypted_gemini_key TEXT,
        encrypted_github_token TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        expires_at TIMESTAMP NOT NULL,
        last_used_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('Created/verified user_sessions table');

    await sql`
      CREATE INDEX IF NOT EXISTS idx_expires ON user_sessions(expires_at)
    `;
    console.log('Created/verified idx_expires index');

    await sql`
      CREATE INDEX IF NOT EXISTS idx_last_used ON user_sessions(last_used_at)
    `;
    console.log('Created/verified idx_last_used index');

    await sql`
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        repo_url TEXT NOT NULL,
        session_id TEXT,
        status TEXT NOT NULL,
        result JSONB,
        error TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES user_sessions(session_id) ON DELETE SET NULL
      )
    `;
    console.log('Created/verified jobs table');

    await sql`
      CREATE INDEX IF NOT EXISTS idx_status ON jobs(status, created_at)
    `;
    console.log('Created/verified idx_status index');

    await sql`
      CREATE INDEX IF NOT EXISTS idx_session ON jobs(session_id)
    `;
    console.log('Created/verified idx_session index');

    await sql`
      CREATE INDEX IF NOT EXISTS idx_created ON jobs(created_at)
    `;
    console.log('Created/verified idx_created index');

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
