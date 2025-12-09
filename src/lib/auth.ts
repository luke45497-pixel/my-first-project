import jwt from 'jsonwebtoken'
import { NextRequest } from 'next/server'

const JWT_SECRET = process.env.JWT_SECRET!
const PRIVATE_USERNAME = process.env.PRIVATE_USERNAME!
const PRIVATE_PASSWORD = process.env.PRIVATE_PASSWORD!

export interface JWTPayload {
  userId: string
  username: string
  iat?: number
  exp?: number
}

/**
 * Generate JWT token for authenticated user
 */
export function generateToken(username: string): string {
  const payload: JWTPayload = {
    userId: 'admin',
    username
  }

  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

/**
 * Verify JWT token
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload
    return decoded
  } catch (error) {
    return null
  }
}

/**
 * Validate credentials against environment variables
 */
export function validateCredentials(username: string, password: string): boolean {
  return username === PRIVATE_USERNAME && password === PRIVATE_PASSWORD
}

/**
 * Extract token from Authorization header
 */
export function extractTokenFromHeader(authHeader?: string): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  return authHeader.substring(7)
}

/**
 * Get token from request (from Authorization header or cookies)
 */
export function getTokenFromRequest(request: NextRequest): string | null {
  // Try Authorization header first
  const authHeader = request.headers.get('authorization')
  const tokenFromHeader = extractTokenFromHeader(authHeader || undefined)

  if (tokenFromHeader) {
    return tokenFromHeader
  }

  // Try cookies
  const tokenFromCookie = request.cookies.get('auth_token')?.value
  return tokenFromCookie || null
}

/**
 * Middleware to check if user is authenticated
 */
export function isAuthenticated(request: NextRequest): boolean {
  const token = getTokenFromRequest(request)

  if (!token) {
    return false
  }

  const payload = verifyToken(token)
  return payload !== null
}

/**
 * Get authenticated user from request
 */
export function getAuthenticatedUser(request: NextRequest): JWTPayload | null {
  const token = getTokenFromRequest(request)

  if (!token) {
    return null
  }

  return verifyToken(token)
}

/**
 * Create response with authentication cookie
 */
export function createAuthResponse(token: string, redirectUrl: string = '/') {
  const response = Response.json(
    { success: true, message: 'Authentication successful' },
    { status: 200 }
  )

  // Set HTTP-only cookie
  response.headers.set(
    'Set-Cookie',
    `auth_token=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${7 * 24 * 60 * 60}`
  )

  return response
}

/**
 * Create logout response that clears the authentication cookie
 */
export function createLogoutResponse() {
  const response = Response.json(
    { success: true, message: 'Logout successful' },
    { status: 200 }
  )

  // Clear the cookie
  response.headers.set(
    'Set-Cookie',
    'auth_token=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0'
  )

  return response
}