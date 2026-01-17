import { NextRequest, NextResponse } from 'next/server';
import { deleteSession } from '@/lib/session';

export async function POST(request: NextRequest) {
  try {
    const sessionId = request.cookies.get('session_id')?.value;

    if (sessionId) {
      await deleteSession(sessionId);
    }

    const response = NextResponse.json({
      success: true,
    });

    response.cookies.delete('session_id');

    return response;
  } catch (error) {
    console.error('Error in /api/logout:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'An unknown error occurred',
      },
      { status: 500 }
    );
  }
}
