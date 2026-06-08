import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Sidebar from '@/components/Sidebar'
import AIChat from '@/components/AIChat'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/login')

  const alertCount = await prisma.alert.count({
    where: { isResolved: false, isRead: false },
  })

  return (
    <div className="app-layout">
      <Sidebar user={session.user as any} alertCount={alertCount} />
      <main className="main-content">
        {children}
      </main>
      <AIChat />
    </div>
  )
}
