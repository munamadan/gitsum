import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

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

    const expiredResult = await sql`
      DELETE FROM user_sessions
      WHERE expires_at < NOW()
      RETURNING session_id
    `;

    const inactiveResult = await sql`
      DELETE FROM user_sessions
      WHERE last_used_at < NOW() - INTERVAL '7 days'
      RETURNING session_id
    `;

    const deletedCount = (expiredResult.rowCount || 0) + (inactiveResult.rowCount || 0);

    console.log(`Deleted ${deletedCount} expired/inactive sessions`);

    return NextResponse.json({
      success: true,
      deletedCount,
    });
  } catch (error) {
    console.error('Error in /api/cron/cleanup-sessions:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'An unknown error occurred',
      },
      { status: 500 }
    );
  }
}
