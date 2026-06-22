import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser, canAccessTenant } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const tenantId = searchParams.get('tenantId')
  const filterTenantId = user.role === 'super_admin' ? (tenantId || undefined) : user.tenantId!

  const items = await db.checklist.findMany({
    where: filterTenantId ? { tenantId: filterTenantId } : {},
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { items: true, answers: true } },
      framework: { select: { code: true, name: true } },
    },
  })
  return NextResponse.json({ items })
}
