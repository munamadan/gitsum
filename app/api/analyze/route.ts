import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionKeys, createSession, updateSession } from '@/lib/session';
import { checkPooledRateLimit, getDailyUsage } from '@/lib/rate-limit';
import { getRepoMetadata } from '@/lib/github';
import { analyzeRepo } from '@/lib/analyzer';
import { nanoid } from 'nanoid';
import { sql } from '@vercel/postgres';

const analyzeSchema = z.object({
  repoUrl: z.string().url().regex(/^https:\/\/github\.com\/[^\/]+\/[^\/]+\/?$/, 'Invalid GitHub URL'),
  os: z.enum(['windows', 'macos', 'linux', 'all']).optional().default('all'),
  geminiKey: z.string().optional(),
  githubToken: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('Received analyze request:', { repoUrl: body.repoUrl, os: body.os });

    const parsed = analyzeSchema.safeParse(body);

    if (!parsed.success) {
      console.error('Validation failed:', parsed.error.errors);
      return NextResponse.json(
        {
          error: 'Validation error',
          message: parsed.error.errors[0].message,
        },
        { status: 400 }
      );
    }

    const { repoUrl, os, geminiKey, githubToken } = parsed.data;
    console.log('Parsed data:', { repoUrl, os, hasGeminiKey: !!geminiKey, hasGithubToken: !!githubToken });

    let sessionId: string | null | undefined = request.cookies.get('session_id')?.value || null;
    let usingUserKey = false;
    let effectiveGeminiKey: string = process.env.GEMINI_API_KEY!;
    let effectiveGithubToken: string | undefined;

    if (sessionId) {
      const sessionKeys = await getSessionKeys(sessionId);

      if (sessionKeys) {
        effectiveGeminiKey = sessionKeys.geminiKey || process.env.GEMINI_API_KEY!;
        effectiveGithubToken = sessionKeys.githubToken || githubToken;
        usingUserKey = !!sessionKeys.geminiKey;

        if (geminiKey && geminiKey !== sessionKeys.geminiKey) {
          await updateSession(sessionId, geminiKey, githubToken);
          effectiveGeminiKey = geminiKey;
          usingUserKey = true;
        }
      } else {
        sessionId = null;
      }
    }

    if (!sessionId) {
      if (geminiKey) {
        sessionId = await createSession(geminiKey, githubToken);
        effectiveGeminiKey = geminiKey;
        effectiveGithubToken = githubToken;
        usingUserKey = true;
      } else {
        const rateLimit = await checkPooledRateLimit();

        if (!rateLimit.allowed) {
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

        effectiveGeminiKey = process.env.GEMINI_API_KEY!;
        effectiveGithubToken = githubToken;
      }
    }

    const metadata = await getRepoMetadata(repoUrl, effectiveGithubToken);

    const sizeInMB = metadata.size / (1024 * 1024);

    if (sizeInMB > 100) {
      return NextResponse.json(
        {
          error: 'Repository too large',
          message: 'Repository exceeds 100MB limit',
        },
        { status: 400 }
      );
    }

    if (sizeInMB >= 20) {
      const jobId = nanoid();

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

      return response;
    }

    const result = await analyzeRepo(repoUrl, {
      geminiKey: effectiveGeminiKey,
      githubToken: effectiveGithubToken,
      userOS: os === 'all' ? undefined : os,
    });

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

    return response;
  } catch (error) {
    console.error('Error in /api/analyze:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'An unknown error occurred',
      },
      { status: 500 }
    );
  }
}
