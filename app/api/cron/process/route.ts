import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { getSessionKeys } from '@/lib/session';
import { analyzeRepo } from '@/lib/analyzer';

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        {
          error: 'Unauthorized',
        },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);

    if (token !== CRON_SECRET) {
      return NextResponse.json(
        {
          error: 'Invalid token',
        },
        { status: 401 }
      );
    }

    const jobsResult = await sql`
      SELECT id, repo_url, session_id
      FROM jobs
      WHERE status = 'queued'
      ORDER BY created_at ASC
      LIMIT 5
    `;

    const jobs = jobsResult.rows;

    console.log(`Processing ${jobs.length} queued jobs`);

    for (const job of jobs) {
      try {
        await sql`
          UPDATE jobs
          SET status = 'processing', started_at = NOW()
          WHERE id = ${job.id}
        `;

        let geminiKey: string;
        let githubToken: string | undefined;

        if (job.session_id) {
          const sessionKeys = await getSessionKeys(job.session_id);

          if (sessionKeys && sessionKeys.geminiKey) {
            geminiKey = sessionKeys.geminiKey;
            githubToken = sessionKeys.githubToken || undefined;
          } else {
            geminiKey = process.env.GEMINI_API_KEY!;
          }
        } else {
          geminiKey = process.env.GEMINI_API_KEY!;
        }

        const result = await analyzeRepo(job.repo_url, {
          geminiKey,
          githubToken,
        });

        await sql`
          UPDATE jobs
          SET status = 'complete', result = ${JSON.stringify(result)}::jsonb, completed_at = NOW()
          WHERE id = ${job.id}
        `;

        console.log(`Job ${job.id} completed successfully`);
      } catch (error) {
        console.error(`Job ${job.id} failed:`, error);

        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        await sql`
          UPDATE jobs
          SET status = 'failed', error = ${errorMessage}::text, completed_at = NOW()
          WHERE id = ${job.id}
        `;
      }
    }

    return NextResponse.json({
      success: true,
      processed: jobs.length,
    });
  } catch (error) {
    console.error('Error in /api/cron/process:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'An unknown error occurred',
      },
      { status: 500 }
    );
  }
}
