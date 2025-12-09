import { createLogoutResponse } from '@/lib/auth'

export async function POST() {
  try {
    return createLogoutResponse()
  } catch (error) {
    console.error('Logout error:', error)
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}