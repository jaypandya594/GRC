'use client'

import { useEffect, useState, useRef } from 'react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/lib/stores'
import { PageHeader, EmptyState } from './shared'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ListChecks, Search, FileText, FolderOpen, User, ChevronRight, Plus, Upload, Download, Eye, Trash2 } from 'lucide-react'
import { STATUS_LABELS, STATUS_BADGE } from '@/lib/types'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type Control = {
  id: string
  ref: string
  title: string
  description: string | null
  category: string | null
  guidance: string | null
  assignment: { id: string; status: string; owner: string | null; notes: string | null } | null
  evidenceCount: number
}

export function ControlsView() {
  const { user } = useAuthStore()
  const isSuperAdmin = user?.role === 'super_admin'
  const [frameworks, setFrameworks] = useState<any[]>([])
  const [selectedFramework, setSelectedFramework] = useState('')
  const [controls, setControls] = useState<Control[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [detailControl, setDetailControl] = useState<Control | null>(null)

  useEffect(() => {
    api('/api/frameworks').then((d: any) => {
      if (!d?.frameworks) return
      setFrameworks(d.frameworks)
      const saved = sessionStorage.getItem('selectedFrameworkId')
      const fw = d.frameworks.find((f: any) => f.id === saved) || d.frameworks[0]
      if (fw) setSelectedFramework(fw.id)
    }).catch(() => {})
  }, [])

  async function loadControls() {
    if (!selectedFramework) return
    setLoading(true)
    try {
      const d: any = await api(`/api/controls?frameworkId=${selectedFramework}`)
      setControls(d?.controls || [])
    } catch (e: any) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    if (selectedFramework) loadControls()
  }, [selectedFramework])

  const categories = Array.from(new Set(controls.map(c => c.category).filter(Boolean)))
  const filtered = controls.filter((c) => {
    if (categoryFilter !== 'all' && c.category !== categoryFilter) return false
    if (statusFilter !== 'all' && c.assignment?.status !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!c.title.toLowerCase().includes(q) && !c.ref.toLowerCase().includes(q) && !c.description?.toLowerCase().includes(q)) return false
    }
    return true
  })

  const stats = {
    total: controls.length,
    compliant: controls.filter(c => ['compliant', 'implemented'].includes(c.assignment?.status || '')).length,
    inProgress: controls.filter(c => c.assignment?.status === 'in_progress').length,
    notStarted: controls.filter(c => !c.assignment || c.assignment.status === 'not_started').length,
  }

  function csvEscape(val: string): string {
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return '"' + val.replace(/"/g, '""') + '"'
    }
    return val
  }

  function exportJSON() {
    const data = controls.map(c => ({
      ref: c.ref,
      title: c.title,
      description: c.description || '',
      category: c.category || '',
      guidance: c.guidance || '',
      status: c.assignment?.status || 'not_started',
      owner: c.assignment?.owner || '',
      notes: c.assignment?.notes || '',
    }))
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${frameworks.find(f => f.id === selectedFramework)?.code || 'controls'}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${data.length} controls as JSON`)
  }

  function exportCSV() {
    const headers = ['ref', 'title', 'description', 'category', 'guidance', 'status', 'owner', 'notes']
    const rows = controls.map(c => [
      csvEscape(c.ref),
      csvEscape(c.title),
      csvEscape(c.description || ''),
      csvEscape(c.category || ''),
      csvEscape(c.guidance || ''),
      csvEscape(c.assignment?.status || 'not_started'),
      csvEscape(c.assignment?.owner || ''),
      csvEscape(c.assignment?.notes || ''),
    ])
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${frameworks.find(f => f.id === selectedFramework)?.code || 'controls'}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${controls.length} controls as CSV`)
  }

  return (
    <div>
      <PageHeader
        title="Control Catalog"
        description="Browse and implement controls across frameworks"
        icon={ListChecks}
        actions={
          isSuperAdmin ? (
            <div className="flex gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" disabled={controls.length === 0}>
                    <Download className="w-4 h-4 mr-2" /> Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => exportJSON()}>
                    Export as JSON
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportCSV()}>
                    Export as CSV
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Dialog open={importOpen} onOpenChange={setImportOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline"><Upload className="w-4 h-4 mr-2" /> Import</Button>
                </DialogTrigger>
                <ImportControlsDialog frameworkId={selectedFramework} onDone={() => { loadControls(); setImportOpen(false) }} />
              </Dialog>
              <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogTrigger asChild>
                  <Button><Plus className="w-4 h-4 mr-2" /> Add Control</Button>
                </DialogTrigger>
                <AddControlDialog frameworks={frameworks} defaultFrameworkId={selectedFramework} onCreated={() => { loadControls(); setAddOpen(false) }} />
              </Dialog>
            </div>
          ) : undefined
        }
      />

      {/* Framework tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {frameworks.map((fw) => (
          <button
            key={fw.id}
            onClick={() => setSelectedFramework(fw.id)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium border transition',
              selectedFramework === fw.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-card hover:bg-muted border-border'
            )}
          >
            {fw.code}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Total</div><div className="text-xl font-bold">{stats.total}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Compliant</div><div className="text-xl font-bold text-emerald-600">{stats.compliant}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">In Progress</div><div className="text-xl font-bold text-amber-600">{stats.inProgress}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Not Started</div><div className="text-xl font-bold text-slate-500">{stats.notStarted}</div></CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search controls…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => <SelectItem key={c} value={c as string}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Controls list */}
      {loading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Card key={i} className="animate-pulse h-16" />)}</div>
      ) : filtered.length === 0 ? (
        <Card><EmptyState icon={ListChecks} title="No controls found" description="Adjust your filters or add/import controls for this framework." /></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => (
            <Card key={c.id} className="overflow-hidden">
              <button
                onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                className="w-full text-left p-4 hover:bg-muted/30 transition"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex flex-col items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-primary leading-tight">{c.ref}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm truncate">{c.title}</h3>
                    {c.category && <Badge variant="secondary" className="text-[10px] mt-0.5">{c.category}</Badge>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {c.assignment ? (
                      <Badge variant="outline" className={cn('text-[10px]', STATUS_BADGE[c.assignment.status])}>{STATUS_LABELS[c.assignment.status]}</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-slate-500">Not Started</Badge>
                    )}
                    {c.evidenceCount > 0 && (
                      <Badge variant="secondary" className="text-[10px]"><FolderOpen className="w-3 h-3 mr-0.5" />{c.evidenceCount}</Badge>
                    )}
                    <ChevronRight className={cn('w-4 h-4 text-muted-foreground transition', expanded === c.id && 'rotate-90')} />
                  </div>
                </div>
              </button>
              {expanded === c.id && (
                <div className="px-4 pb-4 pt-1 border-t bg-muted/20">
                  {c.description && <p className="text-sm text-muted-foreground mt-3">{c.description}</p>}
                  {c.guidance && (
                    <div className="mt-3 p-3 rounded-lg bg-card border">
                      <p className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1"><FileText className="w-3 h-3" /> Implementation Guidance</p>
                      <p className="text-sm">{c.guidance}</p>
                    </div>
                  )}
                  {c.assignment?.owner && (
                    <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                      <User className="w-3.5 h-3.5" /> Owner: <span className="font-medium text-foreground">{c.assignment.owner}</span>
                    </div>
                  )}
                  {c.assignment?.notes && <p className="text-xs mt-2 italic">"{c.assignment.notes}"</p>}
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" variant="outline" onClick={() => setDetailControl(c)}><Eye className="w-3.5 h-3.5 mr-1" /> View Full Details</Button>
                    {isSuperAdmin && (
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={async () => {
                        if (!confirm(`Delete control "${c.ref} — ${c.title}"?`)) return
                        try { await api(`/api/controls?id=${c.id}`, { method: 'DELETE' }); toast.success('Control deleted'); loadControls() }
                        catch (e: any) { toast.error(e.message) }
                      }}><Trash2 className="w-3.5 h-3.5 mr-1" /> Delete</Button>
                    )}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {detailControl && (
        <ControlDetailSheet
          control={detailControl}
          onClose={() => setDetailControl(null)}
          onUpdated={() => {
            setDetailControl(null)
            loadControls()
          }}
        />
      )}
    </div>
  )
}

// ---------- Full Detail Sheet ----------
function ControlDetailSheet({ control, onClose, onUpdated }: { control: Control; onClose: () => void; onUpdated: () => void }) {
  const [status, setStatus] = useState(control.assignment?.status || 'not_started')
  const [owner, setOwner] = useState(control.assignment?.owner || '')
  const [notes, setNotes] = useState(control.assignment?.notes || '')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      await api('/api/control-assignments', {
        method: 'PATCH',
        body: JSON.stringify({ controlId: control.id, status, owner, notes }),
      })
      toast.success('Control status updated')
      onUpdated()
    } catch (e: any) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  return (
    <Sheet open onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Badge variant="secondary" className="font-mono">{control.ref}</Badge>
            {control.title}
          </SheetTitle>
          <SheetDescription>Full control details and implementation status</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          {/* Status & evidence summary */}
          <div className="flex flex-wrap items-center gap-2">
            {control.assignment ? (
              <Badge variant="outline" className={cn('text-xs', STATUS_BADGE[control.assignment.status])}>{STATUS_LABELS[control.assignment.status]}</Badge>
            ) : (
              <Badge variant="outline" className="text-xs text-slate-500">Not Started</Badge>
            )}
            {control.category && <Badge variant="secondary" className="text-xs">{control.category}</Badge>}
            <Badge variant="secondary" className="text-xs"><FolderOpen className="w-3 h-3 mr-0.5" /> {control.evidenceCount} evidence</Badge>
          </div>

          {/* Description */}
          {control.description && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Description</h4>
              <p className="text-sm leading-relaxed">{control.description}</p>
            </div>
          )}

          {/* Guidance */}
          {control.guidance && (
            <div className="p-4 rounded-lg bg-muted/40 border">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1"><FileText className="w-3 h-3" /> Implementation Guidance</h4>
              <p className="text-sm leading-relaxed">{control.guidance}</p>
            </div>
          )}

          {/* Update status form */}
          <div className="p-4 rounded-lg border bg-card">
            <h4 className="text-sm font-semibold mb-3">Update Implementation Status</h4>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Owner</Label>
                <Input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="e.g., Sarah Mitchell" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Implementation Notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Document how this control is implemented…" rows={4} />
              </div>
              <Button onClick={save} disabled={saving} className="w-full">{saving ? 'Saving…' : 'Save Status'}</Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ---------- Add Control Dialog ----------
function AddControlDialog({ frameworks, defaultFrameworkId, onCreated }: { frameworks: any[]; defaultFrameworkId: string; onCreated: () => void }) {
  const [frameworkId, setFrameworkId] = useState(defaultFrameworkId)
  const [ref, setRef] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [guidance, setGuidance] = useState('')
  const [order, setOrder] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { setFrameworkId(defaultFrameworkId) }, [defaultFrameworkId])

  async function submit() {
    if (!frameworkId || !ref || !title) { toast.error('Framework, Ref and Title are required'); return }
    setSaving(true)
    try {
      await api('/api/controls', {
        method: 'POST',
        body: JSON.stringify({ frameworkId, ref, title, description, category, guidance, order: order ? Number(order) : 0 }),
      })
      toast.success(`Control ${ref} added`)
      onCreated()
    } catch (e: any) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>Add Control</DialogTitle>
        <DialogDescription>Add a single control to a framework</DialogDescription>
      </DialogHeader>
      <form onSubmit={(e) => { e.preventDefault(); submit() }} className="space-y-3">
        <div className="space-y-2">
          <Label>Framework *</Label>
          <Select value={frameworkId} onValueChange={setFrameworkId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {frameworks.map((f) => <SelectItem key={f.id} value={f.id}>{f.code}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label>Ref *</Label>
            <Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="A.5.1" className="font-mono" />
          </div>
          <div className="space-y-2 col-span-2">
            <Label>Title *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Policies for information security" />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="What this control requires…" />
        </div>
        <div className="space-y-2">
          <Label>Category</Label>
          <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g., Organizational, Technological" />
        </div>
        <div className="space-y-2">
          <Label>Implementation Guidance</Label>
          <Textarea value={guidance} onChange={(e) => setGuidance(e.target.value)} rows={3} placeholder="How to implement this control…" />
        </div>
        <div className="space-y-2">
          <Label>Order (optional)</Label>
          <Input type="number" value={order} onChange={(e) => setOrder(e.target.value)} placeholder="0" />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCreated}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Adding…' : 'Add Control'}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}

// ---------- Import Controls Dialog ----------
function ImportControlsDialog({ frameworkId, onDone }: { frameworkId: string; onDone: () => void }) {
  const [jsonText, setJsonText] = useState('')
  const [importing, setImporting] = useState(false)
  const [parsedCount, setParsedCount] = useState(0)
  const [parsingFile, setParsingFile] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Reset when opened for a new framework
    setJsonText('')
    setParsedCount(0)
  }, [frameworkId])

  // Flexible header mapping — recognizes common control-catalog column names
  const HEADER_ALIASES: Record<string, string[]> = {
    ref:        ['ref', 'control id', 'criteria id', 'citation', 'control ref', 'id', 'reference', 'clause', 'article'],
    title:      ['title', 'control name', 'name', 'requirement', 'aicpa trust services criteria (the requirement)', 'implementation objective', 'the requirement', 'control'],
    description:['description', 'desc', 'details', 'control description', 'requirement text', 'what it requires'],
    category:   ['category', 'theme', 'domain', 'domain (coso category)', 'safeguard / domain', 'safeguard/domain', 'theme/domain', 'group', 'section', 'family'],
    guidance:   ['guidance', 'standard auditable control (example implementation)', 'implementation guidance', 'example implementation', 'how to implement', 'implementation'],
  }

  function normalizeHeader(h: string): string {
    const lower = h.trim().toLowerCase()
    for (const [canonical, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.includes(lower)) return canonical
    }
    return lower // keep unknown headers as-is
  }

  // Map a raw row object (with various possible header names) to the {ref, title, ...} format
  function mapRow(rawRow: Record<string, string>): any {
    const mapped: any = {}
    for (const [rawKey, val] of Object.entries(rawRow)) {
      const canonical = normalizeHeader(rawKey)
      if (canonical && val) {
        if (!mapped[canonical]) mapped[canonical] = val.trim()
      }
    }
    return mapped
  }

  function parseCsv(text: string): any[] {
    const lines = text.trim().split(/\r?\n/).filter(Boolean)
    if (lines.length < 2) return []
    const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''))
    return lines.slice(1).map((line) => {
      // CSV parse that handles quoted fields with commas
      const vals: string[] = []
      let cur = ''
      let inQuotes = false
      for (let i = 0; i < line.length; i++) {
        const ch = line[i]
        if (ch === '"') { inQuotes = !inQuotes; continue }
        if (ch === ',' && !inQuotes) { vals.push(cur); cur = ''; continue }
        cur += ch
      }
      vals.push(cur)
      const obj: Record<string, string> = {}
      headers.forEach((h, i) => { obj[h] = (vals[i] || '').trim().replace(/^"|"$/g, '') })
      return mapRow(obj)
    })
  }

  // Parse an HTML table (from .docx via mammoth) into control rows
  function parseHtmlTable(html: string): any[] {
    const rows: any[] = []
    // Use DOMParser to extract table rows
    if (typeof DOMParser === 'undefined') return rows
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const tables = doc.querySelectorAll('table')
    tables.forEach((table) => {
      const trs = table.querySelectorAll('tr')
      if (trs.length < 2) return
      // First row = headers
      const headerCells = Array.from(trs[0].querySelectorAll('td, th')).map((c) => c.textContent?.trim() || '')
      if (headerCells.length === 0) return
      // Data rows
      for (let i = 1; i < trs.length; i++) {
        const cells = Array.from(trs[i].querySelectorAll('td, th')).map((c) => c.textContent?.trim() || '')
        if (cells.length === 0) continue
        const obj: Record<string, string> = {}
        headerCells.forEach((h, j) => { if (h) obj[h] = cells[j] || '' })
        rows.push(mapRow(obj))
      }
    })
    return rows
  }

  function parseTextToControls(text: string): any[] {
    const trimmed = text.trim()
    if (!trimmed) return []
    if (trimmed.startsWith('[')) {
      // JSON array — map keys too
      const arr = JSON.parse(trimmed)
      return Array.isArray(arr) ? arr.map((r: any) => {
        // Normalize keys
        const obj: Record<string, string> = {}
        for (const [k, v] of Object.entries(r)) { obj[k] = String(v ?? '') }
        return mapRow(obj)
      }) : []
    }
    return parseCsv(trimmed)
  }

  function recomputeCount(text: string) {
    try {
      const arr = parseTextToControls(text)
      setParsedCount(Array.isArray(arr) ? arr.filter((c) => c.ref && c.title).length : 0)
    } catch {
      setParsedCount(0)
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const name = file.name.toLowerCase()

    if (name.endsWith('.docx')) {
      // Parse Word document using mammoth
      setParsingFile(true)
      try {
        const arrayBuffer = await file.arrayBuffer()
        const mammoth = await import('mammoth')
        const result = await mammoth.convertToHtml({ arrayBuffer })
        const html = result.value || ''
        const controls = parseHtmlTable(html)
        if (controls.length === 0) {
          toast.error('No tables found in the .docx file. Please ensure the document contains a table with headers (e.g. Control ID, Control Name, Description).')
          setJsonText('')
          setParsedCount(0)
        } else {
          // Convert to JSON for display + editing
          const jsonStr = JSON.stringify(controls, null, 2)
          setJsonText(jsonStr)
          setParsedCount(controls.filter((c) => c.ref && c.title).length)
          toast.success(`Parsed ${controls.length} rows from Word document`)
        }
      } catch (err: any) {
        toast.error('Failed to parse .docx file: ' + err.message)
        setJsonText('')
        setParsedCount(0)
      } finally {
        setParsingFile(false)
      }
      // Reset the input so the same file can be selected again
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    // JSON or CSV — read as text
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result || '')
      setJsonText(text)
      recomputeCount(text)
    }
    reader.readAsText(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function submit() {
    const trimmed = jsonText.trim()
    if (!trimmed) { toast.error('Paste JSON/CSV or upload a file first'); return }
    if (!frameworkId) { toast.error('Select a framework first'); return }
    let controls: any[]
    try {
      controls = parseTextToControls(trimmed)
    } catch (err: any) {
      toast.error('Invalid JSON/CSV: ' + err.message)
      return
    }
    if (!Array.isArray(controls) || controls.length === 0) { toast.error('No controls to import'); return }
    const valid = controls.filter((c) => c.ref && c.title)
    if (valid.length === 0) { toast.error('No valid controls — each needs a ref (e.g. "Control ID"/"Citation"/"Ref") and a title (e.g. "Control Name"/"Title")'); return }

    setImporting(true)
    try {
      const res: any = await api('/api/controls/import', {
        method: 'POST',
        body: JSON.stringify({ frameworkId, controls: valid }),
      })
      toast.success(`Imported ${res.created} control${res.created === 1 ? '' : 's'}`)
      onDone()
    } catch (e: any) { toast.error(e.message) }
    finally { setImporting(false) }
  }

  return (
    <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
      <DialogHeader>
        <DialogTitle>Import Controls (Bulk)</DialogTitle>
        <DialogDescription>
          Upload a <strong>Word (.docx)</strong>, <strong>CSV</strong>, or <strong>JSON</strong> file, or paste directly.
          The system auto-detects common column names.
        </DialogDescription>
      </DialogHeader>
      <div className="flex-1 overflow-y-auto -mx-6 px-6 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <input ref={fileInputRef} type="file" accept=".json,.csv,.docx" onChange={handleFile} className="hidden" />
          <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={parsingFile}>
            <Upload className="w-4 h-4 mr-2" /> {parsingFile ? 'Parsing…' : 'Upload .docx / .csv / .json'}
          </Button>
          <span className="text-xs text-muted-foreground">Or paste JSON/CSV directly ↓</span>
        </div>
        <Textarea
          value={jsonText}
          onChange={(e) => { setJsonText(e.target.value); recomputeCount(e.target.value) }}
          rows={10}
          className="font-mono text-xs"
          placeholder={'[\n  {"ref":"A.5.1","title":"Policies for infosec","description":"...","category":"Organizational","guidance":"..."},\n  {"ref":"A.5.2","title":"Roles & responsibilities","category":"Organizational"}\n]\n\n—or CSV—\nref,title,description,category,guidance\nA.5.1,Policies for infosec,...,Organizational,...'}
        />
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            {parsedCount > 0 ? <span className="text-emerald-600 font-medium">{parsedCount} valid control{parsedCount === 1 ? '' : 's'} ready</span> : 'No valid controls detected'}
          </span>
          <code className="text-[10px] text-muted-foreground">Framework: {frameworkId ? 'selected' : 'none'}</code>
        </div>
        <div className="p-3 rounded-lg bg-muted/40 text-[11px] text-muted-foreground">
          <p className="font-semibold mb-1">Supported column headers (auto-mapped):</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
            <span><strong>ref:</strong> Control ID, Criteria ID, Citation, Reference, Clause, Article</span>
            <span><strong>title:</strong> Control Name, Name, Requirement, Implementation Objective</span>
            <span><strong>category:</strong> Theme, Domain, Safeguard, Group, Family</span>
            <span><strong>description:</strong> Description, Details, Requirement Text</span>
            <span className="col-span-2"><strong>guidance:</strong> Standard Auditable Control, Implementation Guidance, Example Implementation</span>
          </div>
          <p className="mt-1.5">For Word (.docx): the document must contain a <strong>table</strong> with headers in the first row.</p>
        </div>
      </div>
      <DialogFooter className="mt-4 shrink-0">
        <Button variant="outline" onClick={onDone}>Cancel</Button>
        <Button onClick={submit} disabled={importing || parsingFile || parsedCount === 0}>
          {importing ? 'Importing…' : `Import ${parsedCount > 0 ? parsedCount : ''} Controls`}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}
