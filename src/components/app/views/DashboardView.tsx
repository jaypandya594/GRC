'use client'

import { useEffect, useState, Fragment } from 'react'
import { api, formatDate, timeAgo } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAuthStore, useUIStore } from '@/lib/stores'
import { STATUS_LABELS, STATUS_BADGE, SEVERITY_BADGE } from '@/lib/types'
import {
  Building2, Users, Shield, FolderOpen, Bug, AlertTriangle, FileText,
  TrendingUp, Activity, ArrowRight, CheckCircle2, Clock, XCircle,
} from 'lucide-react'
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ResponsiveContainer, PieChart, Pie, Cell, Legend, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import { cn } from '@/lib/utils'

type DashboardData = {
  stats: { tenants: number; users: number; frameworks: number; controls: number; evidence: number; vulnerabilities: number; risks: number; audits: number; policies: number }
  complianceStatus: { status: string; count: number }[]
  vulnBySeverity: { severity: string; count: number }[]
  riskHeatmap: { likelihood: number; impact: number; category: string; status: string }[]
  frameworkProgress: { tenantId: string; tenantName: string; framework: string; total: number; compliant: number }[]
  tenantList: { id: string; name: string; slug: string; industry: string; plan: string; status: string }[]
  recentActivity: { id: string; action: string; entity: string; userName: string; createdAt: string }[]
  recentEvidence: { id: string; title: string; type: string; fileName: string; fileUrl: string; uploadedBy: string; controlRef: string; createdAt: string }[]
  openVulns: { id: string; title: string; severity: string; status: string; asset: string }[]
  activeAudits: { id: string; title: string; status: string; startDate: string; endDate: string }[]
}

const FRAMEWORK_NAMES: Record<string, string> = {
  ISO27001: 'ISO 27001',
  SOC2: 'SOC 2',
  GDPR: 'GDPR',
  HIPAA: 'HIPAA',
  PCI_DSS: 'PCI DSS',
  NIST_CSF: 'NIST CSF',
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#e11d48',
  high: '#ea580c',
  medium: '#d97706',
  low: '#0284c7',
  info: '#64748b',
}

export function DashboardView() {
  const { user } = useAuthStore()
  const { setActiveView } = useUIStore()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api('/api/dashboard')
      .then((d) => {
        // Guard: a 401 returns {} — ignore so the app can redirect to login.
        if (d && d.stats) setData(d as DashboardData)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading || !data || !data.stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="h-32" />
          </Card>
        ))}
      </div>
    )
  }

  const isSuperAdmin = user?.role === 'super_admin'
  const totalControls = data.complianceStatus.reduce((s, c) => s + c.count, 0)
  const compliantCount = data.complianceStatus.filter(c => ['compliant', 'implemented'].includes(c.status)).reduce((s, c) => s + c.count, 0)
  const complianceScore = totalControls > 0 ? Math.round((compliantCount / totalControls) * 100) : 0

  const radarData = data.frameworkProgress
    .filter((f) => isSuperAdmin ? true : f.tenantId === user?.tenantId)
    .reduce((acc: any[], fp) => {
      const pct = fp.total > 0 ? Math.round((fp.compliant / fp.total) * 100) : 0
      const existing = acc.find(a => a.framework === FRAMEWORK_NAMES[fp.framework])
      if (existing) existing.score = (existing.score + pct) / 2
      else acc.push({ framework: FRAMEWORK_NAMES[fp.framework], score: pct })
      return acc
    }, [])

  const pieData = data.complianceStatus.map(s => ({ name: STATUS_LABELS[s.status] || s.status, value: s.count, status: s.status }))

  const vulnPie = data.vulnBySeverity.map(v => ({ name: v.severity, value: v.count }))

  const heatmapBuckets: { label: string; count: number; level: number }[] = []
  for (let l = 1; l <= 5; l++) {
    for (let i = 1; i <= 5; i++) {
      const count = data.riskHeatmap.filter(r => r.likelihood === l && r.impact === i).length
      const score = l * i
      const level = score >= 15 ? 4 : score >= 10 ? 3 : score >= 5 ? 2 : 1
      heatmapBuckets.push({ label: `${l}×${i}`, count, level })
    }
  }

  const stats = [
    ...(isSuperAdmin ? [{ label: 'Tenants', value: data.stats.tenants, icon: Building2, color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/40', view: 'tenants' }] : []),
    { label: 'Users', value: data.stats.users, icon: Users, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40', view: 'users' },
    { label: 'Frameworks', value: data.stats.frameworks, icon: Shield, color: 'text-teal-600 bg-teal-50 dark:bg-teal-950/40', view: 'frameworks' },
    { label: 'Evidence', value: data.stats.evidence, icon: FolderOpen, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40', view: 'evidence' },
    { label: 'Vulnerabilities', value: data.stats.vulnerabilities, icon: Bug, color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/40', view: 'vulnerabilities' },
    { label: 'Risks', value: data.stats.risks, icon: AlertTriangle, color: 'text-orange-600 bg-orange-50 dark:bg-orange-950/40', view: 'risks' },
    { label: 'Audits', value: data.stats.audits, icon: Activity, color: 'text-sky-600 bg-sky-50 dark:bg-sky-950/40', view: 'audits' },
    { label: 'Policies', value: data.stats.policies, icon: FileText, color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40', view: 'policies' },
  ]

  return (
    <div className="space-y-6">
      {/* Welcome banner — iSecurify purple */}
      <div className="rounded-xl bg-gradient-to-br from-[#812671] via-[#6b1f5e] to-[#1B887D] text-white p-6 lg:p-8 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">Welcome back, {user?.name.split(' ')[0]} 👋</h1>
            <p className="text-white/80 mt-1.5">
              {isSuperAdmin
                ? 'You have platform-wide visibility across all tenants.'
                : `Managing compliance for ${user?.tenant?.name}.`}
            </p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-4xl font-bold">{complianceScore}%</div>
              <div className="text-xs text-white/70 uppercase tracking-wider">Compliance Score</div>
            </div>
            <div className="h-12 w-px bg-white/20" />
            <div className="text-center">
              <div className="text-4xl font-bold">{data.openVulns.length}</div>
              <div className="text-xs text-white/70 uppercase tracking-wider">Open Issues</div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 lg:gap-4">
        {stats.map((s) => {
          const Icon = s.icon
          return (
            <button
              key={s.label}
              onClick={() => setActiveView(s.view)}
              className="text-left"
            >
              <Card className="hover:shadow-md transition-shadow h-full">
                <CardContent className="p-4 lg:p-5">
                  <div className="flex items-center justify-between">
                    <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', s.color)}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground/40" />
                  </div>
                  <div className="mt-3">
                    <div className="text-2xl font-bold">{s.value}</div>
                    <div className="text-xs text-muted-foreground">{s.label}</div>
                  </div>
                </CardContent>
              </Card>
            </button>
          )
        })}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Compliance radar */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Framework Compliance</CardTitle>
            <CardDescription>Compliance score across frameworks</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="framework" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }} />
                <Radar dataKey="score" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.4} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', fontSize: 12 }} />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Compliance status pie */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Control Status</CardTitle>
            <CardDescription>Distribution of control implementation</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={85}
                  paddingAngle={2}
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={STATUS_PIE_COLORS[entry.status] || '#94a3b8'} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Vulnerabilities by severity */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Vulnerabilities</CardTitle>
            <CardDescription>Open issues by severity</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={vulnPie} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} width={60} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', fontSize: 12 }} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {vulnPie.map((entry, i) => (
                    <Cell key={i} fill={SEVERITY_COLORS[entry.name] || '#94a3b8'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Risk heatmap + framework progress */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Risk Heatmap</CardTitle>
            <CardDescription>Likelihood × Impact distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-6 gap-1 text-xs">
              <div></div>
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="text-center font-medium text-muted-foreground pb-1">I={i}</div>
              ))}
              {[5, 4, 3, 2, 1].map(l => (
                <Fragment key={`row-${l}`}>
                  <div className="flex items-center justify-end font-medium text-muted-foreground pr-1">L={l}</div>
                  {[1, 2, 3, 4, 5].map(i => {
                    const bucket = heatmapBuckets.find(b => b.label === `${l}×${i}`)!
                    return (
                      <div
                        key={`${l}-${i}`}
                        className={cn(
                          'aspect-square rounded flex items-center justify-center font-semibold text-white',
                          HEATMAP_COLORS[bucket.level]
                        )}
                        title={`Likelihood ${l} × Impact ${i}: ${bucket.count} risks`}
                      >
                        {bucket.count > 0 ? bucket.count : ''}
                      </div>
                    )
                  })}
                </Fragment>
              ))}
            </div>
            <div className="flex items-center justify-between mt-3 text-[10px] text-muted-foreground">
              <span>Low risk</span>
              <div className="flex gap-1">
                <div className="w-4 h-4 rounded bg-emerald-200" />
                <div className="w-4 h-4 rounded bg-amber-300" />
                <div className="w-4 h-4 rounded bg-orange-400" />
                <div className="w-4 h-4 rounded bg-rose-600" />
              </div>
              <span>Critical risk</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {isSuperAdmin ? 'Tenant Framework Progress' : 'Framework Progress'}
            </CardTitle>
            <CardDescription>
              {isSuperAdmin ? 'Compliance across tenants' : 'Your compliance posture'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[260px]">
              <div className="space-y-3 pr-3">
                {(isSuperAdmin ? data.frameworkProgress : data.frameworkProgress.filter(f => f.tenantId === user?.tenantId)).map((fp, i) => {
                  const pct = fp.total > 0 ? Math.round((fp.compliant / fp.total) * 100) : 0
                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          {isSuperAdmin && <span className="text-xs text-muted-foreground truncate">{fp.tenantName} ·</span>}
                          <span className="font-medium">{FRAMEWORK_NAMES[fp.framework] || fp.framework}</span>
                        </div>
                        <span className="font-semibold text-xs">{fp.compliant}/{fp.total} ({pct}%)</span>
                      </div>
                      <Progress value={pct} className="h-1.5" />
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Recent activity + Open vulns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Recent Activity</CardTitle>
              <CardDescription>Latest actions across the platform</CardDescription>
            </div>
            <Activity className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[280px]">
              <div className="space-y-3 pr-3">
                {data.recentActivity.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No recent activity</p>
                ) : (
                  data.recentActivity.map((a) => (
                    <div key={a.id} className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Activity className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">
                          <span className="font-medium">{a.userName}</span>{' '}
                          <span className="text-muted-foreground">{formatAction(a.action)}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">{timeAgo(a.createdAt)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Open Vulnerabilities</CardTitle>
              <CardDescription>Issues needing attention</CardDescription>
            </div>
            <Bug className="w-4 h-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[280px]">
              <div className="space-y-2 pr-3">
                {data.openVulns.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500 mb-2" />
                    <p className="text-sm text-muted-foreground">All clear! No open vulnerabilities.</p>
                  </div>
                ) : (
                  data.openVulns.map((v) => (
                    <div key={v.id} className="flex items-center gap-3 p-2.5 rounded-lg border bg-card hover:bg-muted/50 transition">
                      <Badge variant="outline" className={cn('capitalize', SEVERITY_BADGE[v.severity])}>{v.severity}</Badge>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{v.title}</p>
                        <p className="text-xs text-muted-foreground">{v.asset}</p>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => setActiveView('vulnerabilities')}>
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Recent evidence + Active audits */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Recent Evidence</CardTitle>
              <CardDescription>Latest compliance artifacts</CardDescription>
            </div>
            <FolderOpen className="w-4 h-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[280px]">
              <div className="space-y-2 pr-3">
                {data.recentEvidence.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No evidence yet</p>
                ) : (
                  data.recentEvidence.map((e) => (
                    <div key={e.id} className="flex items-center gap-3 p-2.5 rounded-lg border bg-card hover:bg-muted/50 transition">
                      <div className="w-8 h-8 rounded bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center shrink-0">
                        {e.type === 'link' ? <FileText className="w-4 h-4 text-amber-600" /> : <FolderOpen className="w-4 h-4 text-amber-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{e.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {e.controlRef && <Badge variant="secondary" className="text-[10px] mr-1">{e.controlRef}</Badge>}
                          by {e.uploadedBy} · {timeAgo(e.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Active Audits</CardTitle>
              <CardDescription>In-progress audit engagements</CardDescription>
            </div>
            <Activity className="w-4 h-4 text-sky-500" />
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[280px]">
              <div className="space-y-2 pr-3">
                {data.activeAudits.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No active audits</p>
                ) : (
                  data.activeAudits.map((a) => (
                    <div key={a.id} className="flex items-center gap-3 p-2.5 rounded-lg border bg-card hover:bg-muted/50 transition">
                      <div className="w-8 h-8 rounded bg-sky-100 dark:bg-sky-950/40 flex items-center justify-center shrink-0">
                        <Clock className="w-4 h-4 text-sky-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{a.title}</p>
                        <p className="text-xs text-muted-foreground capitalize">{a.status.replace('_', ' ')} · ends {formatDate(a.endDate)}</p>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => setActiveView('audits')}>
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

const STATUS_PIE_COLORS: Record<string, string> = {
  compliant: '#10b981',
  implemented: '#14b8a6',
  in_progress: '#f59e0b',
  not_started: '#94a3b8',
  non_compliant: '#e11d48',
}

const HEATMAP_COLORS: Record<number, string> = {
  1: 'bg-emerald-200 dark:bg-emerald-900',
  2: 'bg-amber-300 dark:bg-amber-800',
  3: 'bg-orange-400 dark:bg-orange-700',
  4: 'bg-rose-600 dark:bg-rose-800',
}

function formatAction(action: string): string {
  return action.replace(/[._]/g, ' ')
}
