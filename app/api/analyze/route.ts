import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionKeys, createSession, updateSession } from '@/lib/session';
import { checkPooledRateLimit, getDailyUsage } from '@/lib/rate-limit';
import { getRepoMetadata } from '@/lib/github';
import { analyzeRepo } from '@/lib/analyzer';
import { nanoid } from 'nanoid';
import { sql } from '@vercel/postgres';

const analyzeSchema = z.object({
  repoUrl: z.string().url().regex(/^https:\/\/github\.com\/[^\/]+\/[^\/]+(\/)?$/, 'Invalid GitHub URL'),
  os: z.enum(['windows', 'macos', 'linux', 'all']).optional().default('all'),
  geminiKey: z.string().optional(),
  githubToken: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  console.log('='.repeat(80));
  console.log(`[${requestId}] === ANALYZE REQUEST START ===`);
  console.log('='.repeat(80));
  
  try {
    const body = await request.json();
    console.log(`[${requestId}] Request body:`, JSON.stringify({ repoUrl: body.repoUrl, os: body.os, hasGeminiKey: !!body.geminiKey, hasGithubToken: !!body.githubToken }));

    const parsed = analyzeSchema.safeParse(body);

    if (!parsed.success) {
      console.error(`[${requestId}] Validation failed:`, JSON.stringify(parsed.error.errors));
      const errorMsg = parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
      console.error(`[${requestId}] Validation error message:`, errorMsg);
      
      return NextResponse.json(
        {
          error: 'Validation error',
          message: errorMsg,
        },
        { status: 400 }
      );
    }

    const { repoUrl, os, geminiKey, githubToken } = parsed.data;
    console.log(`[${requestId}] Parsed successfully:`, { repoUrl, os });

    let sessionId: string | null | undefined = request.cookies.get('session_id')?.value || null;
    let usingUserKey = false;
    let effectiveGeminiKey: string = process.env.GEMINI_API_KEY!;
    let effectiveGithubToken: string | undefined;

    console.log(`[${requestId}] Session check:`, { sessionId, hasSession: !!sessionId });

    if (sessionId) {
      console.log(`[${requestId}] Fetching session keys for:`, sessionId);
      const sessionKeys = await getSessionKeys(sessionId);

      if (sessionKeys) {
        console.log(`[${requestId}] Session keys found:`, { hasGeminiKey: !!sessionKeys.geminiKey, hasGithubToken: !!sessionKeys.githubToken });
        effectiveGeminiKey = sessionKeys.geminiKey || process.env.GEMINI_API_KEY!;
        effectiveGithubToken = sessionKeys.githubToken || githubToken;
        usingUserKey = !!sessionKeys.geminiKey;

        if (geminiKey && geminiKey !== sessionKeys.geminiKey) {
          console.log(`[${requestId}] Updating session with new keys`);
          await updateSession(sessionId, geminiKey, githubToken);
          effectiveGeminiKey = geminiKey;
          usingUserKey = true;
        }
      } else {
        console.log(`[${requestId}] Session keys not found, clearing sessionId`);
        sessionId = null;
      }
    }

    if (!sessionId) {
      if (geminiKey) {
        console.log(`[${requestId}] Creating new session with user key`);
        sessionId = await createSession(geminiKey, githubToken);
        effectiveGeminiKey = geminiKey;
        effectiveGithubToken = githubToken;
        usingUserKey = true;
      } else {
        console.log(`[${requestId}] Checking pooled rate limit`);
        const rateLimit = await checkPooledRateLimit();

        if (!rateLimit.allowed) {
          console.log(`[${requestId}] Rate limit exceeded:`, { remaining: rateLimit.remaining, resetAt: rateLimit.resetAt });
          return NextResponse.json(
            {
              error: 'Rate limit exceeded',
              message: 'Daily limit reached. Please try again later or provide your own API key.',
              resetAt: rateLimit.resetAt.toISOString(),
              suggestion: 'Add your Gemini API key in Advanced Options for unlimited access',
            },
            { status: 429 }
          );
        }

        console.log(`[${requestId}] Using pooled API key`);
        effectiveGeminiKey = process.env.GEMINI_API_KEY!;
        effectiveGithubToken = githubToken;
      }
    }

    console.log(`[${requestId}] Fetching repo metadata for:`, repoUrl);
    const metadata = await getRepoMetadata(repoUrl, effectiveGithubToken);
    console.log(`[${requestId}] Repo metadata:`, { name: metadata.full_name, size: metadata.size, isPrivate: metadata.private });

    const sizeInMB = metadata.size / (1024 * 1024);

    if (sizeInMB > 100) {
      console.log(`[${requestId}] Repository too large:`, { sizeMB: sizeInMB });
      return NextResponse.json(
        {
          error: 'Repository too large',
          message: 'Repository exceeds 100MB limit',
        },
        { status: 400 }
      );
    }

    if (sizeInMB >= 20) {
      console.log(`[${requestId}] Repository requires queued processing:`, { sizeMB: sizeInMB });
      const jobId = nanoid();
      console.log(`[${requestId}] Created job ID:`, jobId);

      await sql`
        INSERT INTO jobs (id, repo_url, session_id, status, created_at)
        VALUES (${jobId}, ${repoUrl}, ${sessionId}, 'queued', NOW())
      `;

      const response = NextResponse.json({
        status: 'queued',
        jobId,
        pollUrl: `/api/status/${jobId}`,
        estimatedTime: '1-2 minutes',
        usingUserKey,
      });

      if (sessionId) {
        response.cookies.set('session_id', sessionId, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 86400,
          path: '/',
        });
      }

      console.log(`[${requestId}] Returning queued response:`, { jobId, sessionId });
      return response;
    }

    console.log(`[${requestId}] Starting repository analysis`);
    const result = await analyzeRepo(repoUrl, {
      geminiKey: effectiveGeminiKey,
      githubToken: effectiveGithubToken,
      userOS: os === 'all' ? undefined : os,
    });

    console.log(`[${requestId}] Analysis completed successfully`);

    const response = NextResponse.json({
      status: 'complete',
      result,
      usingUserKey,
    });

    if (sessionId) {
      response.cookies.set('session_id', sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 86400,
        path: '/',
      });
    }

    console.log(`[${requestId}] Returning complete response`);
    return response;
  } catch (error) {
    console.error(`[${requestId}] === ERROR in /api/analyze ===`, {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack?.split('\n').slice(0, 5) : 'No stack trace available',
      cause: error instanceof Error ? (error.cause ? String(error.cause) : 'No cause') : 'Unknown'
    });

    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error(`[${requestId}] Returning error to client:`, errorMessage);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: errorMessage,
      },
      { status: 500 }
    );
  }
}
