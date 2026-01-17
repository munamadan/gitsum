import { NextRequest, NextResponse } from 'next/server';
import { getSessionKeys } from '@/lib/session';
import { getDailyUsage } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.cookies.get('session_id')?.value;
    let isUsingUserKey = false;

    if (sessionId) {
      const sessionKeys = await getSessionKeys(sessionId);
      if (sessionKeys && sessionKeys.geminiKey) {
        isUsingUserKey = true;
      }
    }

    if (isUsingUserKey) {
      return NextResponse.json({
        remaining: 999999,
        total: 999999,
        resetAt: new Date(Date.now() + 86400000).toISOString(),
        isUsingUserKey: true,
      });
    }

    const usage = await getDailyUsage();

    return NextResponse.json({
      remaining: usage.remaining,
      total: usage.total,
      resetAt: usage.resetAt.toISOString(),
      isUsingUserKey: false,
    });
  } catch (error) {
    console.error('Error in /api/quota:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'An unknown error occurred',
      },
      { status: 500 }
    );
  }
}
