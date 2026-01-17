import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { getSessionKeys } from '@/lib/session';
import { analyzeRepo } from '@/lib/analyzer';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;

    const result = await sql`
      SELECT id, status, result, error, created_at, started_at
      FROM jobs
      WHERE id = ${jobId}
    `;

    if (result.rows.length === 0) {
      return NextResponse.json(
        {
          error: 'Job not found',
        },
        { status: 404 }
      );
    }

    const job = result.rows[0];

    if (job.status === 'queued') {
      return NextResponse.json({
        status: 'queued',
        message: 'Job is queued for processing',
        estimatedTime: '1-2 minutes',
      });
    }

    if (job.status === 'processing') {
      return NextResponse.json({
        status: 'processing',
        message: 'Job is being processed',
      });
    }

    if (job.status === 'failed') {
      return NextResponse.json({
        status: 'failed',
        error: job.error || 'Job failed with unknown error',
      });
    }

    if (job.status === 'complete') {
      return NextResponse.json({
        status: 'complete',
        result: job.result,
      });
    }

    return NextResponse.json(
      {
        error: 'Unknown job status',
      },
      { status: 500 }
    );
  } catch (error) {
    console.error('Error in /api/status:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'An unknown error occurred',
      },
      { status: 500 }
    );
  }
}
