import { NextRequest, NextResponse } from 'next/server'
import { validateCredentials, generateToken, createAuthResponse } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json()

    // Validate input
    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: 'Username and password are required' },
        { status: 400 }
      )
    }

    // Validate credentials
    if (!validateCredentials(username, password)) {
      return NextResponse.json(
        { success: false, error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    // Generate token and create response
    const token = generateToken(username)
    return createAuthResponse(token)

  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}