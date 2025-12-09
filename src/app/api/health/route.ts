import { NextResponse } from 'next/server'

export async function GET() {
  try {
    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'football-predictions-api',
      version: '1.0.0'
    })
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        message: 'Health check failed'
      },
      { status: 500 }
    )
  }
}