import { sql } from '@vercel/postgres';
import { encrypt, decrypt } from './crypto';
import { nanoid } from 'nanoid';

export async function createSession(
  geminiKey?: string,
  githubToken?: string
): Promise<string> {
  const sessionId = nanoid();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await sql`
    INSERT INTO user_sessions (session_id, encrypted_gemini_key, encrypted_github_token, expires_at, last_used_at)
    VALUES (${sessionId}, ${geminiKey ? encrypt(geminiKey) : null}, ${githubToken ? encrypt(githubToken) : null}, ${expiresAt.toISOString()}::timestamp, NOW())
  `;

  return sessionId;
}

export async function getSessionKeys(
  sessionId: string
): Promise<{ geminiKey: string | null; githubToken: string | null } | null> {
  const result = await sql`
    SELECT encrypted_gemini_key, encrypted_github_token, expires_at
    FROM user_sessions
    WHERE session_id = ${sessionId}
  `;

  if (result.rows.length === 0) {
    return null;
  }

  const session = result.rows[0];

  if (new Date(session.expires_at) < new Date()) {
    await deleteSession(sessionId);
    return null;
  }

  await sql`
    UPDATE user_sessions
    SET last_used_at = NOW()
    WHERE session_id = ${sessionId}
  `;

  return {
    geminiKey: session.encrypted_gemini_key ? decrypt(session.encrypted_gemini_key) : null,
    githubToken: session.encrypted_github_token ? decrypt(session.encrypted_github_token) : null,
  };
}

export async function deleteSession(sessionId: string): Promise<void> {
  await sql`DELETE FROM user_sessions WHERE session_id = ${sessionId}`;
}

export async function updateSession(
  sessionId: string,
  geminiKey?: string,
  githubToken?: string
): Promise<void> {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  if (geminiKey !== undefined || githubToken !== undefined) {
    await sql`
      UPDATE user_sessions
      SET
        encrypted_gemini_key = COALESCE(${geminiKey !== undefined ? encrypt(geminiKey) : null}, encrypted_gemini_key),
        encrypted_github_token = COALESCE(${githubToken !== undefined ? encrypt(githubToken) : null}, encrypted_github_token),
        expires_at = ${expiresAt.toISOString()}::timestamp,
        last_used_at = NOW()
      WHERE session_id = ${sessionId}
    `;
  } else {
    await sql`
      UPDATE user_sessions
      SET
        expires_at = ${expiresAt.toISOString()}::timestamp,
        last_used_at = NOW()
      WHERE session_id = ${sessionId}
    `;
  }
}
