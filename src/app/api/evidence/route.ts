import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser, canAccessTenant } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const controlId = searchParams.get('controlId')
  const tenantId = searchParams.get('tenantId')

  const filterTenantId = user.role === 'super_admin' ? (tenantId || undefined) : user.tenantId!

  const where: any = {}
  if (filterTenantId) where.tenantId = filterTenantId
  if (controlId) where.controlId = controlId

  const evidence = await db.evidence.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      uploadedBy: { select: { id: true, name: true, email: true } },
      control: { select: { id: true, ref: true, title: true, frameworkId: true, framework: { select: { code: true, name: true } } } },
    },
  })
  return NextResponse.json({ evidence })
}

// Create evidence (link type or pre-uploaded file metadata)
export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { title, description, type, controlId, fileUrl, linkTitle, fileName, filePath, fileSize, mimeType, tags, status, validUntil, tenantId } = body

  const targetTenantId = user.role === 'super_admin' ? (tenantId || user.tenantId) : user.tenantId
  if (!targetTenantId) return NextResponse.json({ error: 'Tenant required' }, { status: 400 })
  if (!canAccessTenant(user, targetTenantId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (!title || !type) return NextResponse.json({ error: 'Title and type required' }, { status: 400 })
  if (type === 'link' && !fileUrl) return NextResponse.json({ error: 'URL required for link evidence' }, { status: 400 })
  if (type === 'file' && !fileName && !filePath) return NextResponse.json({ error: 'File required' }, { status: 400 })

  const evidence = await db.evidence.create({
    data: {
      tenantId: targetTenantId,
      controlId: controlId || null,
      uploadedById: user.id,
      title,
      description,
      type,
      fileName,
      filePath,
      fileSize,
      mimeType,
      fileUrl,
      linkTitle,
      tags,
      status: status || 'active',
      validUntil: validUntil ? new Date(validUntil) : null,
    },
    include: { control: { select: { ref: true, title: true } } },
  })

  await db.auditLog.create({
    data: {
      userId: user.id,
      tenantId: targetTenantId,
      action: 'evidence.create',
      entity: 'evidence',
      entityId: evidence.id,
      meta: JSON.stringify({ title, type }),
    },
  })

  return NextResponse.json({ evidence })
}

export async function PATCH(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { id, title, description, status, tags, fileUrl, linkTitle } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const existing = await db.evidence.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!canAccessTenant(user, existing.tenantId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const updated = await db.evidence.update({
    where: { id },
    data: { title, description, status, tags, fileUrl, linkTitle },
  })
  return NextResponse.json({ evidence: updated })
}

export async function DELETE(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const existing = await db.evidence.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!canAccessTenant(user, existing.tenantId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Delete file from disk if applicable
  if (existing.filePath) {
    const fs = await import('fs/promises')
    const path = await import('path')
    const fullPath = path.join(process.cwd(), 'public', existing.filePath)
    await fs.unlink(fullPath).catch(() => {})
  }

  await db.evidence.delete({ where: { id } })
  await db.auditLog.create({
    data: {
      userId: user.id,
      tenantId: existing.tenantId,
      action: 'evidence.delete',
      entity: 'evidence',
      entityId: id,
    },
  })
  return NextResponse.json({ ok: true })
}
