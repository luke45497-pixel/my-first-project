import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const user = getAuthenticatedUser(request)

    if (!user) {
      return Response.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      )
    }

    return Response.json({
      success: true,
      data: {
        userId: user.userId,
        username: user.username
      }
    })

  } catch (error) {
    console.error('Auth check error:', error)
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}