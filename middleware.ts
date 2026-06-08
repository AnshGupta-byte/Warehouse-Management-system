import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import type { NextRequest } from 'next/server'

export default async function middleware(request: NextRequest) {
  const session = await auth()

  const isAuthPage = request.nextUrl.pathname.startsWith('/login')
  const isPublicApi = request.nextUrl.pathname.startsWith('/api/auth')

  if (isPublicApi) return NextResponse.next()

  if (!session && !isAuthPage) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (session && isAuthPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
