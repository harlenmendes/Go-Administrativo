import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  BellRing,
  Calendar,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  EyeOff,
  FileText,
  Link2,
  Loader2,
  PackageCheck,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  Unlink,
  UserCheck,
  UsersRound,
  X,
} from 'lucide-react'
import { usePacientesStore } from '@/stores/usePacientesStore'
import { getGoogleConnectUrl } from '@/lib/fechamentoApi'
import { exportarProntuarioParaPDF } from '@/lib/exportPdf'
import {
  assignSessionToPackage,
  deletePackage,
  fetchPacotesOverview,
  ignoreCalendarEvent,
  linkCalendarNames,
  restoreIgnoredCalendarEvent,
  unlinkCalendarName,
  type PacotesOverviewResponse,
} from '@/lib/pacotesApi'
import {
  computePacotesState,
  formatBRL,
  formatISODateToBR,
  formatMonthLabel,
  getPackageTypeLabel,
  getWeekBounds,
  shiftISODate,
  type ComputedPackage,
  type ComputedSessionItem,
  type ResolvedCalendarEvent,
} from './pacotesHelpers'
import { CreateOrEditPackageModal } from './CreateOrEditPackageModal'
import { LinkCalendarModal } from './LinkCalendarModal'
import { PackageReportModal } from './PackageReportModal'
import { PackageAgendaPickerModal } from './PackageAgendaPickerModal'

type PacotesTab = 'semana' | 'pacientes' | 'vinculos' | 'relatorio'

function shiftMonthStr(baseMonth: string, delta: number): string {
  const [yStr, mStr] = baseMonth.split('-')
  let y = parseInt(yStr, 10)
  let m = parseInt(mStr, 10) + delta
  while (m < 1) {
    m += 12
    y -= 1
  }
  while (m > 12) {
    m -= 12
    y += 1
  }
  return `${y}-${String(m).padStart(2, '0')}`
}

export function Pacotes() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { pacientes, fetchPacientes } = usePacientesStore()

  const initialTab = (searchParams.get('tab') as PacotesTab) || 'semana'
  const initialPatientId = searchParams.get('paciente') || ''

  const [activeTab, setActiveTab] = useState<PacotesTab>(initialTab)
  const [baseMonth, setBaseMonth] = useState<string>('')
  const [selectedWeekStart, setSelectedWeekStart] = useState<string>('')
  const [overview, setOverview] = useState<PacotesOverviewResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null)

  // Filtros e buscas
  const [searchPaciente, setSearchPaciente] = useState('')
  const [pkgFilter, setPkgFilter] = useState<'todos' | 'active' | 'sem_inicio' | 'renovar'>('todos')
  const [searchLinkPaciente, setSearchLinkPaciente] = useState('')
  const [reportPacienteId, setReportPacienteId] = useState(initialPatientId)
  const [showIgnored, setShowIgnored] = useState(false)

  // Atribuição rápida de pacote para um evento pendente
  const [assigningEventId, setAssigningEventId] = useState<string | null>(null)
  const [addingAliasForPacienteId, setAddingAliasForPacienteId] = useState<string | null>(null)
  const [customAliasInput, setCustomAliasInput] = useState('')

  // Modais
  const [pkgModalOpen, setPkgModalOpen] = useState(false)
  const [editingPkg, setEditingPkg] = useState<ComputedPackage | null>(null)
  const [seedPacienteId, setSeedPacienteId] = useState<string | null>(null)
  const [seedEvent, setSeedEvent] = useState<ResolvedCalendarEvent | null>(null)

  const [linkModalNames, setLinkModalNames] = useState<string[]>([])
  const [linkModalOpen, setLinkModalOpen] = useState(false)
  const [linkModalDefaultPacienteId, setLinkModalDefaultPacienteId] = useState<string | null>(null)

  const [reportModalPkgId, setReportModalPkgId] = useState<string | null>(null)
  const [agendaPickerPkgId, setAgendaPickerPkgId] = useState<string | null>(null)
  const [agendaPickerReplacingSession, setAgendaPickerReplacingSession] =
    useState<ComputedSessionItem | null>(null)
  const [exportingFullReport, setExportingFullReport] = useState(false)

  const showToast = useCallback((msg: string, err = false) => {
    setToast({ msg, err })
    setTimeout(() => {
      setToast((prev) => (prev?.msg === msg ? null : prev))
    }, 3400)
  }, [])

  const loadData = useCallback(
    async (monthOverride?: string, silent = false) => {
      if (!silent) setLoading(true)
      else setRefreshing(true)
      try {
        await fetchPacientes()
        const data = await fetchPacotesOverview(monthOverride ?? (baseMonth || undefined))
        setOverview(data)
        if (!baseMonth && data.window?.currentMonth) {
          setBaseMonth(data.window.currentMonth)
        }
        if (!selectedWeekStart && data.today) {
          setSelectedWeekStart(getWeekBounds(data.today).weekStart)
        }
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Erro ao carregar pacotes.', true)
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [baseMonth, fetchPacientes, showToast]
  )

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const computed = useMemo(() => {
    if (!overview) return null
    return computePacotesState({
      today: overview.today,
      selectedWeekStart: selectedWeekStart || undefined,
      pacientes,
      events: overview.events,
      links: overview.links,
      mappings: overview.mappings,
      packages: overview.packages,
      sessions: overview.sessions,
      exclusions: overview.exclusions,
    })
  }, [overview, pacientes, selectedWeekStart])

  const handleChangeBaseMonth = (delta: number) => {
    const current = baseMonth || overview?.window.currentMonth || ''
    if (!current) return
    const next = shiftMonthStr(current, delta)
    setBaseMonth(next)
    loadData(next, true)
  }

  const handleShiftWeek = (deltaWeeks: number) => {
    const currentStart =
      selectedWeekStart || (overview?.today ? getWeekBounds(overview.today).weekStart : '')
    if (!currentStart) return
    const nextStart = shiftISODate(currentStart, deltaWeeks * 7)
    const nextEnd = shiftISODate(nextStart, 6)
    setSelectedWeekStart(nextStart)
    setAssigningEventId(null)

    if (
      overview?.window &&
      (nextStart < overview.window.startDate || nextEnd > overview.window.endDate)
    ) {
      const targetMonth = nextStart.slice(0, 7)
      setBaseMonth(targetMonth)
      loadData(targetMonth, true)
    }
  }

  const handleGoCurrentWeek = () => {
    if (!overview?.today) return
    const currentWeekStart = getWeekBounds(overview.today).weekStart
    const currentWeekEnd = shiftISODate(currentWeekStart, 6)
    setSelectedWeekStart(currentWeekStart)
    setAssigningEventId(null)

    if (
      overview?.window &&
      (currentWeekStart < overview.window.startDate || currentWeekEnd > overview.window.endDate)
    ) {
      const targetMonth = overview.today.slice(0, 7)
      setBaseMonth(targetMonth)
      loadData(targetMonth, true)
    }
  }

  const openCreatePackageFresh = (pacienteId?: string | null) => {
    setEditingPkg(null)
    setSeedPacienteId(pacienteId || null)
    setSeedEvent(null)
    setPkgModalOpen(true)
  }

  const openCreatePackageFromEvent = (ev: ResolvedCalendarEvent) => {
    setEditingPkg(null)
    setSeedPacienteId(ev.pacienteId)
    setSeedEvent(ev)
    setPkgModalOpen(true)
  }

  const openEditPackage = (cp: ComputedPackage) => {
    setEditingPkg(cp)
    setSeedPacienteId(null)
    setSeedEvent(null)
    setPkgModalOpen(true)
  }

  const openLinkModal = (names: string[], defaultPacienteId?: string | null) => {
    setLinkModalNames(names)
    setLinkModalDefaultPacienteId(defaultPacienteId || null)
    setLinkModalOpen(true)
  }

  const handleQuickAssign = async (pkgId: string, ev: ResolvedCalendarEvent) => {
    if (!pkgId) return
    const targetCp = computed?.allComputedPackages.find((c) => c.pkg.id === pkgId)
    const targetLabel = targetCp
      ? `${targetCp.paciente?.nome || 'Sem paciente'} — ${getPackageTypeLabel(
          targetCp.pkg.package_type,
          targetCp.pkg.total_sessions
        )}`
      : 'este pacote'
    const ownerDiffers = Boolean(
      targetCp && targetCp.pkg.paciente_id && targetCp.pkg.paciente_id !== ev.pacienteId
    )
    const msg = ownerDiffers
      ? `Este atendimento (${ev.rawSummary}) pertence a outra pessoa.\nConfirmar o vínculo do dia ${ev.displayDate} ao pacote de ${targetLabel}?`
      : `Confirmar o vínculo do atendimento de ${ev.displayDate} (${ev.rawSummary}) ao pacote "${targetLabel}"?`
    if (!confirm(msg)) {
      setAssigningEventId(null)
      return
    }
    try {
      await assignSessionToPackage(pkgId, ev)
      setAssigningEventId(null)
      showToast(`Atendimento de ${ev.displayDate} vinculado ao pacote!`)
      await loadData(undefined, true)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao vincular sessão.', true)
    }
  }

  const handleIgnoreEvent = async (ev: ResolvedCalendarEvent) => {
    try {
      await ignoreCalendarEvent({
        calendar_event_id: ev.eventId,
        paciente_id: ev.pacienteId,
        event_date: ev.date,
        calendar_summary: ev.rawSummary,
        reason: 'ignored',
      })
      showToast('Atendimento marcado como desconsiderado.')
      await loadData(undefined, true)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao desconsiderar.', true)
    }
  }

  const handleRestoreIgnored = async (eventId: string) => {
    try {
      await restoreIgnoredCalendarEvent(eventId)
      showToast('Atendimento restaurado.')
      await loadData(undefined, true)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao restaurar.', true)
    }
  }

  const handleDeletePackage = async (cp: ComputedPackage) => {
    if (
      !confirm(
        `Excluir o pacote "${getPackageTypeLabel(cp.pkg.package_type, cp.pkg.total_sessions)}" de ${
          cp.paciente?.nome || 'paciente'
        }?\nAs sessões vinculadas ficarão livres/pendentes novamente.`
      )
    ) {
      return
    }
    try {
      await deletePackage(cp.pkg.id)
      showToast('Pacote excluído.')
      await loadData(undefined, true)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao excluir pacote.', true)
    }
  }

  const handleUnlinkName = async (linkId: string, name: string) => {
    if (!confirm(`Desvincular o nome "#${name}" deste paciente?`)) return
    try {
      await unlinkCalendarName(linkId)
      showToast(`Nome "#${name}" desvinculado.`)
      await loadData(undefined, true)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao desvincular.', true)
    }
  }

  const handleAddCustomAlias = async (pacienteId: string) => {
    const clean = customAliasInput.trim().replace(/^#/, '')
    if (!clean) return
    const normalized = clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase()
    try {
      await linkCalendarNames(pacienteId, [normalized])
      setAddingAliasForPacienteId(null)
      setCustomAliasInput('')
      showToast(`Nome "#${normalized}" vinculado ao paciente!`)
      await loadData(undefined, true)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao adicionar nome.', true)
    }
  }

  const reportModalComputedPkg = useMemo(() => {
    if (!reportModalPkgId || !computed) return null
    return computed.allComputedPackages.find((c) => c.pkg.id === reportModalPkgId) || null
  }, [reportModalPkgId, computed])

  const agendaPickerTargetPkg = useMemo(() => {
    if (!agendaPickerPkgId || !computed) return null
    return computed.allComputedPackages.find((c) => c.pkg.id === agendaPickerPkgId) || null
  }, [agendaPickerPkgId, computed])

  const allActivePackages = useMemo(() => {
    if (!computed) return []
    return computed.allComputedPackages.filter((c) => c.pkg.status !== 'cancelled')
  }, [computed])

  const allAvailablePackagesWithRoom = useMemo(() => {
    return allActivePackages
      .filter((cp) => cp.remainingCount > 0)
      .slice()
      .sort((a, b) =>
        (a.paciente?.nome || 'ZZZ').localeCompare(b.paciente?.nome || 'ZZZ', 'pt-BR')
      )
  }, [allActivePackages])

  const isViewingCurrentWeek = useMemo(() => {
    if (!overview?.today || !computed) return true
    return computed.weekBounds.weekStart === getWeekBounds(overview.today).weekStart
  }, [overview, computed])

  const reportModalOtherPackages = useMemo(() => {
    if (!reportModalComputedPkg || !computed || !reportModalComputedPkg.pkg.paciente_id) return []
    return computed.allComputedPackages.filter(
      (c) =>
        c.pkg.paciente_id === reportModalComputedPkg.pkg.paciente_id &&
        c.pkg.id !== reportModalComputedPkg.pkg.id &&
        c.pkg.status !== 'cancelled'
    )
  }, [reportModalComputedPkg, computed])

  const reportModalFreeEvents = useMemo(() => {
    if (!reportModalComputedPkg || !computed || !reportModalComputedPkg.pkg.paciente_id) return []
    const summary = computed.patientSummaries.find(
      (s) => s.paciente.id === reportModalComputedPkg.pkg.paciente_id
    )
    if (!summary) return []
    return [...summary.pendingEvents, ...summary.legacyEvents].sort((a, b) =>
      a.eventDatetime.localeCompare(b.eventDatetime)
    )
  }, [reportModalComputedPkg, computed])

  const reportModalLinkedNames = useMemo(() => {
    if (!reportModalComputedPkg || !computed || !reportModalComputedPkg.pkg.paciente_id) return []
    const summary = computed.patientSummaries.find(
      (s) => s.paciente.id === reportModalComputedPkg.pkg.paciente_id
    )
    return summary ? summary.directLinks.map((l) => l.calendar_name) : []
  }, [reportModalComputedPkg, computed])

  const selectedReportPatientSummary = useMemo(() => {
    if (!computed) return null
    const targetId = reportPacienteId || computed.patientSummaries.find((s) => s.packages.length > 0)?.paciente.id || ''
    return computed.patientSummaries.find((s) => s.paciente.id === targetId) || null
  }, [computed, reportPacienteId])

  const weekPendingCount = useMemo(() => {
    if (!computed) return 0
    return computed.weekEvents.filter(
      (ev) => ev.isFromCutoff && ev.pendingKind !== 'assigned'
    ).length
  }, [computed])

  const totalAlertsCount = useMemo(() => {
    if (!computed) return 0
    return (
      computed.unlinkedGroups.length +
      computed.pendingEventsFromCutoff.length +
      computed.packagesWithoutStartDate.length +
      computed.unassignedPatientPackages.length
    )
  }, [computed])

  const activePackagesCount = useMemo(() => {
    if (!computed) return 0
    return computed.allComputedPackages.filter((cp) => cp.pkg.status === 'active').length
  }, [computed])

  const nearEndCount = useMemo(() => {
    if (!computed) return 0
    return computed.allComputedPackages.filter((cp) => cp.isNearEnd).length
  }, [computed])

  const filteredPatientSummaries = useMemo(() => {
    if (!computed) return []
    return computed.patientSummaries
      .filter((s) => {
        const matchesSearch =
          s.paciente.nome.toLowerCase().includes(searchPaciente.toLowerCase()) ||
          s.directLinks.some((l) =>
            l.calendar_name.toLowerCase().includes(searchPaciente.toLowerCase())
          )
        if (!matchesSearch) return false

        if (pkgFilter === 'todos') {
          return s.packages.length > 0 || s.pendingEvents.length > 0
        }
        if (pkgFilter === 'active') {
          return s.packages.some((p) => p.pkg.status === 'active')
        }
        if (pkgFilter === 'sem_inicio') {
          return s.packages.some((p) => p.needsStartDate)
        }
        if (pkgFilter === 'renovar') {
          return s.packages.some((p) => p.isNearEnd)
        }
        return true
      })
      .sort((a, b) => a.paciente.nome.localeCompare(b.paciente.nome))
  }, [computed, searchPaciente, pkgFilter])

  const filteredLinkPatientSummaries = useMemo(() => {
    if (!computed) return []
    return computed.patientSummaries
      .filter(
        (s) =>
          s.paciente.nome.toLowerCase().includes(searchLinkPaciente.toLowerCase()) ||
          s.directLinks.some((l) =>
            l.calendar_name.toLowerCase().includes(searchLinkPaciente.toLowerCase())
          )
      )
      .sort((a, b) => {
        // Mostra primeiro quem já tem vínculo ou se está buscando
        if (b.directLinks.length !== a.directLinks.length) {
          return b.directLinks.length - a.directLinks.length
        }
        return a.paciente.nome.localeCompare(b.paciente.nome)
      })
  }, [computed, searchLinkPaciente])

  const handleExportFullPatientReport = async () => {
    if (!selectedReportPatientSummary) return
    setExportingFullReport(true)
    try {
      await exportarProntuarioParaPDF(
        'relatorio-completo-paciente',
        selectedReportPatientSummary.paciente.nome,
        'Relatorio_Pacotes'
      )
    } finally {
      setExportingFullReport(false)
    }
  }

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Cabeçalho */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-secondary-600 mb-1.5">
            Gestão de Sessões · Google Calendar
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-primary tracking-tight">
            Controle de Pacotes
          </h1>
          {overview && (
            <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-brand-muted">
              <span>Leitura automática de 3 meses:</span>
              <div className="inline-flex items-center gap-1 bg-white border border-brand-border rounded-xl px-2 py-1">
                <button
                  type="button"
                  onClick={() => handleChangeBaseMonth(-1)}
                  className="p-1 rounded-lg hover:bg-brand-cream text-primary"
                  title="Mês anterior"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="font-bold text-primary px-1.5">
                  {formatMonthLabel(overview.window.prevMonth)} ·{' '}
                  <span className="text-secondary-700">
                    {formatMonthLabel(overview.window.currentMonth)}
                  </span>{' '}
                  · {formatMonthLabel(overview.window.nextMonth)}
                </span>
                <button
                  type="button"
                  onClick={() => handleChangeBaseMonth(1)}
                  className="p-1 rounded-lg hover:bg-brand-cream text-primary"
                  title="Próximo mês"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 self-start lg:self-auto">
          {overview && !overview.googleConnected && (
            <a
              href={getGoogleConnectUrl('/pacotes')}
              className="btn-outline py-3 px-4 text-xs border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100"
            >
              <Link2 size={15} />
              Conectar Google Agenda
            </a>
          )}

          <button
            type="button"
            onClick={() => loadData(undefined, true)}
            disabled={refreshing || loading}
            className="btn-outline py-3 px-4 text-xs"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            Atualizar Agenda
          </button>

          <button
            type="button"
            onClick={() => openCreatePackageFresh(null)}
            className="btn-primary py-3 px-5 text-xs"
          >
            <Plus size={16} />
            Novo Pacote
          </button>
        </div>
      </header>

      {/* Cards de Indicadores */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <button
          type="button"
          onClick={() => setActiveTab('semana')}
          className="bg-white rounded-3xl p-6 border border-brand-border shadow-card hover:shadow-card-hover transition-all text-left flex items-center gap-4"
        >
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${
              weekPendingCount > 0 ? 'bg-amber-50 text-amber-600' : 'bg-secondary-50 text-secondary-700'
            }`}
          >
            <CalendarDays size={22} />
          </div>
          <div>
            <p className="text-xs font-medium text-brand-muted">
              {isViewingCurrentWeek ? 'Na Semana Atual' : 'Semana Selecionada'}
            </p>
            <p className="text-2xl font-bold text-primary mt-0.5">
              {computed ? computed.weekEvents.length : '—'}
            </p>
            {weekPendingCount > 0 && (
              <p className="text-[11px] font-semibold text-amber-700 mt-0.5">
                {weekPendingCount} sem pacote/vínculo
              </p>
            )}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('semana')}
          className="bg-white rounded-3xl p-6 border border-brand-border shadow-card hover:shadow-card-hover transition-all text-left flex items-center gap-4"
        >
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${
              totalAlertsCount > 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
            }`}
          >
            <BellRing size={22} />
          </div>
          <div>
            <p className="text-xs font-medium text-brand-muted">Pendências (Mês 11+)</p>
            <p className="text-2xl font-bold text-primary mt-0.5">{totalAlertsCount}</p>
            <p className="text-[11px] text-brand-muted mt-0.5">
              {computed ? `${computed.unlinkedGroups.length} sem vínculo · ${computed.pendingEventsFromCutoff.length} dias livres` : '—'}
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('pacientes')
            setPkgFilter('sem_inicio')
          }}
          className="bg-white rounded-3xl p-6 border border-brand-border shadow-card hover:shadow-card-hover transition-all text-left flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
            <Clock size={22} />
          </div>
          <div>
            <p className="text-xs font-medium text-brand-muted">Pacotes Sem Início</p>
            <p className="text-2xl font-bold text-primary mt-0.5">
              {computed ? computed.packagesWithoutStartDate.length : '—'}
            </p>
            <p className="text-[11px] text-brand-muted mt-0.5">Aguardando data na agenda</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('pacientes')
            setPkgFilter(nearEndCount > 0 ? 'renovar' : 'active')
          }}
          className="bg-white rounded-3xl p-6 border border-brand-border shadow-card hover:shadow-card-hover transition-all text-left flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-2xl bg-primary-50 text-primary flex items-center justify-center flex-shrink-0">
            <PackageCheck size={22} />
          </div>
          <div>
            <p className="text-xs font-medium text-brand-muted">Pacotes Ativos</p>
            <p className="text-2xl font-bold text-primary mt-0.5">{activePackagesCount}</p>
            {nearEndCount > 0 && (
              <p className="text-[11px] font-semibold text-secondary-700 mt-0.5">
                {nearEndCount} para renovar
              </p>
            )}
          </div>
        </button>
      </section>

      {/* Abas Principais */}
      <div className="inline-flex flex-wrap gap-1.5 p-1.5 bg-white border border-brand-border rounded-2xl shadow-xs">
        {(
          [
            { id: 'semana', label: 'Semana & Alertas', icon: BellRing, badge: totalAlertsCount },
            { id: 'pacientes', label: 'Pacotes por Paciente', icon: PackageCheck },
            {
              id: 'vinculos',
              label: 'Vincular Agenda (1→N)',
              icon: UsersRound,
              badge: computed?.unlinkedGroups.length || 0,
            },
            { id: 'relatorio', label: 'Relatório do Paciente', icon: FileText },
          ] as { id: PacotesTab; label: string; icon: typeof BellRing; badge?: number }[]
        ).map(({ id, label, icon: Icon, badge }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === id
                ? 'bg-primary text-white shadow-xs'
                : 'text-brand-muted hover:text-primary'
            }`}
          >
            <Icon size={15} />
            <span>{label}</span>
            {badge !== undefined && badge > 0 && (
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  activeTab === id
                    ? 'bg-white/20 text-white'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="bg-white rounded-3xl border border-brand-border p-16 flex flex-col items-center justify-center gap-3">
          <Loader2 size={28} className="animate-spin text-secondary-600" />
          <p className="text-sm text-brand-muted font-medium">
            Sincronizando pacotes e Google Calendar...
          </p>
        </div>
      ) : !computed ? null : (
        <>
          {/* ============================================================== */}
          {/* ABA 1: SEMANA & ALERTAS                                        */}
          {/* ============================================================== */}
          {activeTab === 'semana' && (
            <div className="space-y-8 animate-fade-in">
              {/* 1A. Pacotes Sem Data de Início */}
              {computed.packagesWithoutStartDate.length > 0 && (
                <section className="bg-amber-50/70 border border-amber-200 rounded-3xl p-6 sm:p-7 space-y-4">
                  <div className="flex items-center gap-3">
                    <AlertTriangle size={20} className="text-amber-600 flex-shrink-0" />
                    <div>
                      <h2 className="text-base font-bold text-amber-950">
                        Pacotes cadastrados aguardando data de início ({computed.packagesWithoutStartDate.length})
                      </h2>
                      <p className="text-xs text-amber-800">
                        Vincule a data de início na agenda para começar a descontar as sessões automaticamente.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {computed.packagesWithoutStartDate.map((cp) => (
                      <div
                        key={cp.pkg.id}
                        className="bg-white rounded-2xl p-4 border border-amber-200 flex items-center justify-between gap-4"
                      >
                        <div>
                          <p className="text-sm font-bold text-primary">
                            {cp.paciente?.nome || 'Paciente'}
                          </p>
                          <p className="text-xs text-brand-muted mt-0.5">
                            {getPackageTypeLabel(cp.pkg.package_type, cp.pkg.total_sessions)} ·{' '}
                            {formatBRL(cp.pkg.session_price)}/sessão
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => openEditPackage(cp)}
                          className="btn-secondary py-2 px-3.5 text-xs flex-shrink-0"
                        >
                          <Calendar size={14} />
                          Definir Início
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* 1A-bis. Pacotes sem Paciente Único vinculado */}
              {computed.unassignedPatientPackages.length > 0 && (
                <section className="bg-amber-50/70 border border-amber-200 rounded-3xl p-6 sm:p-7 space-y-4">
                  <div className="flex items-center gap-3">
                    <UsersRound size={20} className="text-amber-700 flex-shrink-0" />
                    <div>
                      <h2 className="text-base font-bold text-amber-950">
                        Pacotes sem Paciente Único vinculado ({computed.unassignedPatientPackages.length})
                      </h2>
                      <p className="text-xs text-amber-800">
                        Esses pacotes tiveram o paciente desvinculado e aguardam um novo titular ou exclusão.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {computed.unassignedPatientPackages.map((cp) => (
                      <div
                        key={cp.pkg.id}
                        className="bg-white rounded-2xl p-4 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div>
                          <p className="text-sm font-bold text-primary">
                            {getPackageTypeLabel(cp.pkg.package_type, cp.pkg.total_sessions)}
                            {cp.pkg.label ? ` · ${cp.pkg.label}` : ''}
                          </p>
                          <p className="text-xs text-brand-muted mt-0.5">
                            {cp.usedTotal}/{cp.pkg.total_sessions} sessões · Início{' '}
                            {formatISODateToBR(cp.pkg.start_date)}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => openEditPackage(cp)}
                            className="btn-primary py-1.5 px-3 text-xs"
                          >
                            <UserCheck size={13} />
                            Vincular Paciente
                          </button>
                          <button
                            type="button"
                            onClick={() => setReportModalPkgId(cp.pkg.id)}
                            className="px-3 py-1.5 rounded-xl bg-brand-cream hover:bg-primary-50 text-primary text-xs font-semibold"
                          >
                            Gerenciar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePackage(cp)}
                            className="p-1.5 rounded-xl text-brand-muted hover:text-red-600 hover:bg-red-50"
                            title="Excluir pacote"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* 1B. Atendimentos da Semana com Navegação */}
              <section className="bg-white rounded-3xl border border-brand-border shadow-card p-6 sm:p-8 space-y-5">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-primary">
                      Atendimentos da Semana ({formatISODateToBR(computed.weekBounds.weekStart)} a{' '}
                      {formatISODateToBR(computed.weekBounds.weekEnd)})
                    </h2>
                    <p className="text-xs text-brand-muted mt-0.5">
                      Navegue pelas semanas para conferir sessões, trocar vínculos ou vincular atendimentos (inclusive de familiar/outra pessoa).
                    </p>
                  </div>

                  <div className="inline-flex items-center bg-brand-cream p-1 rounded-2xl border border-brand-border self-start lg:self-auto flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => handleShiftWeek(-1)}
                      title="Semana anterior"
                      className="w-9 h-8 rounded-xl flex items-center justify-center text-primary hover:bg-white transition-colors"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={handleGoCurrentWeek}
                      className={`px-3 h-8 rounded-xl text-xs font-bold transition-colors ${
                        isViewingCurrentWeek
                          ? 'bg-primary text-white shadow-sm'
                          : 'text-primary hover:bg-white'
                      }`}
                    >
                      Semana Atual
                    </button>
                    <button
                      type="button"
                      onClick={() => handleShiftWeek(1)}
                      title="Próxima semana"
                      className="w-9 h-8 rounded-xl flex items-center justify-center text-primary hover:bg-white transition-colors"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>

                {!overview?.googleConnected ? (
                  <div className="p-8 rounded-2xl bg-brand-offwhite border border-brand-border text-center space-y-3">
                    <p className="text-sm text-brand-muted">
                      {overview?.googleAuthExpired
                        ? 'Sua sessão com o Google Agenda expirou. Reconecte sua conta para visualizar e vincular os atendimentos.'
                        : 'Conecte sua conta Google Agenda para visualizar os atendimentos desta semana e distribuir nos pacotes.'}
                    </p>
                    <a
                      href={getGoogleConnectUrl('/pacotes')}
                      className="btn-primary inline-flex text-xs py-2.5 px-5"
                    >
                      <Link2 size={15} />
                      {overview?.googleAuthExpired
                        ? 'Reconectar Google Agenda'
                        : 'Conectar Google Agenda'}
                    </a>
                  </div>
                ) : computed.weekEvents.length === 0 ? (
                  <div className="p-8 rounded-2xl bg-brand-offwhite border border-dashed border-brand-border text-center text-sm text-brand-muted">
                    Nenhum atendimento com "#" encontrado na agenda desta semana.
                  </div>
                ) : (
                  <div className="divide-y divide-brand-border border border-brand-border rounded-2xl overflow-hidden">
                    {computed.weekEvents.map((ev) => {
                      const ownAvailablePkgs = ev.pacienteId
                        ? allAvailablePackagesWithRoom.filter(
                            (cp) => cp.pkg.paciente_id === ev.pacienteId
                          )
                        : []
                      const otherAvailablePkgs = allAvailablePackagesWithRoom.filter(
                        (cp) => cp.pkg.paciente_id !== ev.pacienteId
                      )

                      return (
                        <div
                          key={ev.eventId}
                          className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-brand-offwhite/60 transition-colors"
                        >
                          <div className="flex items-start sm:items-center gap-4 min-w-0">
                            <div className="w-16 rounded-2xl bg-brand-cream px-2.5 py-2 text-center flex-shrink-0">
                              <p className="text-xs font-bold text-primary">{ev.displayDate.slice(0, 5)}</p>
                              <p className="text-[11px] font-medium text-brand-muted">{ev.startTime}</p>
                            </div>

                            <div className="min-w-0 space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm sm:text-base font-bold text-primary truncate">
                                  {ev.pacienteNome || ev.calendarName}
                                </span>
                                {ev.pendingKind === 'assigned' && ev.packageRecord ? (
                                  <span
                                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                      ev.packageRecord.isNearEnd
                                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                        : 'bg-emerald-50 text-emerald-700'
                                    }`}
                                  >
                                    Sessão {ev.sessionNumber}/{ev.packageRecord.pkg.total_sessions}
                                    {ev.packageRecord.isNearEnd && ' · Renovar'}
                                  </span>
                                ) : ev.pendingKind === 'unlinked_patient' ? (
                                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-700">
                                    Sem vínculo com Paciente
                                  </span>
                                ) : ev.pendingKind === 'legacy_ok' ? (
                                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                                    Anterior ao Mês 11
                                  </span>
                                ) : (
                                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                    Sem pacote
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-brand-muted truncate">
                                {ev.weekday} · Evento: {ev.rawSummary}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                            {ev.pendingKind === 'assigned' && ev.packageRecord ? (
                              <button
                                type="button"
                                onClick={() => setReportModalPkgId(ev.packageRecord!.pkg.id)}
                                className="px-3.5 py-2 rounded-xl bg-brand-cream hover:bg-primary-50 text-primary text-xs font-semibold transition-colors"
                              >
                                Ver Pacote
                              </button>
                            ) : ev.pendingKind === 'unlinked_patient' ? (
                              <>
                                {allAvailablePackagesWithRoom.length > 0 &&
                                  (assigningEventId === ev.eventId ? (
                                    <select
                                      defaultValue=""
                                      onChange={(e) => handleQuickAssign(e.target.value, ev)}
                                      className="px-3 py-2 rounded-xl border border-secondary text-xs font-semibold text-primary bg-white max-w-[240px]"
                                    >
                                      <option value="">Escolher pacote ativo...</option>
                                      {allAvailablePackagesWithRoom.map((cp) => (
                                        <option key={cp.pkg.id} value={cp.pkg.id}>
                                          {cp.paciente?.nome || 'Sem paciente'} ·{' '}
                                          {getPackageTypeLabel(cp.pkg.package_type, cp.pkg.total_sessions)} (
                                          {cp.usedTotal}/{cp.pkg.total_sessions})
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setAssigningEventId(ev.eventId)}
                                      className="px-3 py-2 rounded-xl bg-secondary-50 text-secondary-800 hover:bg-secondary-100 text-xs font-semibold transition-colors"
                                    >
                                      Vincular a Pacote
                                    </button>
                                  ))}
                                <button
                                  type="button"
                                  onClick={() => openLinkModal([ev.calendarName])}
                                  className="btn-primary py-2 px-3.5 text-xs"
                                >
                                  <Link2 size={14} />
                                  Vincular Paciente
                                </button>
                              </>
                            ) : (
                              <>
                                {allAvailablePackagesWithRoom.length > 0 &&
                                  (assigningEventId === ev.eventId ? (
                                    <select
                                      defaultValue=""
                                      onChange={(e) => handleQuickAssign(e.target.value, ev)}
                                      className="px-3 py-2 rounded-xl border border-secondary text-xs font-semibold text-primary bg-white max-w-[240px]"
                                    >
                                      <option value="">Escolher pacote...</option>
                                      {ownAvailablePkgs.length > 0 && (
                                        <optgroup label="Pacotes deste paciente">
                                          {ownAvailablePkgs.map((cp) => (
                                            <option key={cp.pkg.id} value={cp.pkg.id}>
                                              {getPackageTypeLabel(cp.pkg.package_type, cp.pkg.total_sessions)} (
                                              {cp.usedTotal}/{cp.pkg.total_sessions})
                                            </option>
                                          ))}
                                        </optgroup>
                                      )}
                                      {otherAvailablePkgs.length > 0 && (
                                        <optgroup label="Outros pacientes (ex: familiar)">
                                          {otherAvailablePkgs.map((cp) => (
                                            <option key={cp.pkg.id} value={cp.pkg.id}>
                                              {cp.paciente?.nome || 'Sem paciente'} ·{' '}
                                              {getPackageTypeLabel(cp.pkg.package_type, cp.pkg.total_sessions)} (
                                              {cp.usedTotal}/{cp.pkg.total_sessions})
                                            </option>
                                          ))}
                                        </optgroup>
                                      )}
                                    </select>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setAssigningEventId(ev.eventId)}
                                      className="px-3 py-2 rounded-xl bg-secondary-50 text-secondary-800 hover:bg-secondary-100 text-xs font-semibold transition-colors"
                                    >
                                      Vincular a Pacote
                                    </button>
                                  ))}
                                <button
                                  type="button"
                                  onClick={() => openCreatePackageFromEvent(ev)}
                                  className="btn-primary py-2 px-3.5 text-xs"
                                >
                                  <Plus size={14} />
                                  Criar Pacote
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleIgnoreEvent(ev)}
                                  title="Desconsiderar atendimento"
                                  className="p-2 rounded-xl text-brand-muted hover:text-red-600 hover:bg-red-50 transition-colors"
                                >
                                  <EyeOff size={15} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>

              {/* 1C. Nomes na Agenda sem vínculo (Mês 11+) */}
              {computed.unlinkedGroups.length > 0 && (
                <section className="bg-white rounded-3xl border border-brand-border shadow-card p-6 sm:p-8 space-y-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-bold text-primary">
                        Nomes da Agenda sem Vínculo (a partir de Nov/2026)
                      </h2>
                      <p className="text-xs text-brand-muted mt-0.5">
                        Vincule cada nome da agenda ao Paciente Único (vários nomes podem apontar para o mesmo paciente).
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('vinculos')}
                      className="text-xs font-semibold text-secondary-700 hover:text-primary"
                    >
                      Abrir tela 1→N
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {computed.unlinkedGroups.map((g) => (
                      <div
                        key={g.calendarName}
                        className="p-4 rounded-2xl border border-brand-border bg-brand-offwhite flex items-center justify-between gap-4"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-primary truncate">
                            #{g.calendarName}
                          </p>
                          <p className="text-xs text-brand-muted mt-0.5">
                            {g.cutoffEventsCount} atendimento(s) · Ex: {g.sampleDates.join(', ')}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => openLinkModal([g.calendarName])}
                          className="btn-outline py-2 px-3.5 text-xs flex-shrink-0"
                        >
                          <Link2 size={14} />
                          Vincular
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* 1D. Atendimentos Pendentes (sem pacote / removidos a partir do Mês 11) */}
              {computed.pendingEventsFromCutoff.length > 0 && (
                <section className="bg-white rounded-3xl border border-brand-border shadow-card p-6 sm:p-8 space-y-5">
                  <div>
                    <h2 className="text-lg font-bold text-primary">
                      Atendimentos Pendentes de Pacote (a partir de Nov/2026)
                    </h2>
                    <p className="text-xs text-brand-muted mt-0.5">
                      Inclui atendimentos sem pacote ativo ou dias que você tirou manualmente de um pacote.
                    </p>
                  </div>

                  <div className="divide-y divide-brand-border border border-brand-border rounded-2xl overflow-hidden">
                    {computed.pendingEventsFromCutoff.map((ev) => {
                      const ownAvailablePkgs = ev.pacienteId
                        ? allAvailablePackagesWithRoom.filter(
                            (cp) => cp.pkg.paciente_id === ev.pacienteId
                          )
                        : []
                      const otherAvailablePkgs = allAvailablePackagesWithRoom.filter(
                        (cp) => cp.pkg.paciente_id !== ev.pacienteId
                      )

                      return (
                        <div
                          key={ev.eventId}
                          className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-bold text-primary">
                                {ev.displayDate}
                              </span>
                              <span className="text-xs font-semibold text-secondary-700">
                                {ev.pacienteNome}
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800">
                                {ev.pendingKind === 'detached_pending'
                                  ? 'Removido de pacote'
                                  : 'Sem pacote'}
                              </span>
                            </div>
                            <p className="text-xs text-brand-muted truncate mt-0.5">
                              {ev.weekday} · {ev.startTime} · {ev.rawSummary}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                            {allAvailablePackagesWithRoom.length > 0 &&
                              (assigningEventId === `pending-${ev.eventId}` ? (
                                <select
                                  defaultValue=""
                                  onChange={(e) => handleQuickAssign(e.target.value, ev)}
                                  className="px-3 py-1.5 rounded-xl border border-secondary text-xs font-semibold text-primary bg-white max-w-[240px]"
                                >
                                  <option value="">Escolher pacote...</option>
                                  {ownAvailablePkgs.length > 0 && (
                                    <optgroup label="Pacotes deste paciente">
                                      {ownAvailablePkgs.map((cp) => (
                                        <option key={cp.pkg.id} value={cp.pkg.id}>
                                          {getPackageTypeLabel(cp.pkg.package_type, cp.pkg.total_sessions)} (
                                          {cp.usedTotal}/{cp.pkg.total_sessions})
                                        </option>
                                      ))}
                                    </optgroup>
                                  )}
                                  {otherAvailablePkgs.length > 0 && (
                                    <optgroup label="Outros pacientes (ex: familiar)">
                                      {otherAvailablePkgs.map((cp) => (
                                        <option key={cp.pkg.id} value={cp.pkg.id}>
                                          {cp.paciente?.nome || 'Sem paciente'} ·{' '}
                                          {getPackageTypeLabel(cp.pkg.package_type, cp.pkg.total_sessions)} (
                                          {cp.usedTotal}/{cp.pkg.total_sessions})
                                        </option>
                                      ))}
                                    </optgroup>
                                  )}
                                </select>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setAssigningEventId(`pending-${ev.eventId}`)}
                                  className="px-3 py-1.5 rounded-xl bg-secondary-50 text-secondary-800 hover:bg-secondary-100 text-xs font-semibold"
                                >
                                  Vincular a Pacote
                                </button>
                              ))}
                            <button
                              type="button"
                              onClick={() => openCreatePackageFromEvent(ev)}
                              className="btn-outline py-1.5 px-3 text-xs"
                            >
                              <Plus size={13} />
                              Criar Pacote
                            </button>
                            <button
                              type="button"
                              onClick={() => handleIgnoreEvent(ev)}
                              className="p-1.5 rounded-xl text-brand-muted hover:text-red-600 hover:bg-red-50"
                              title="Desconsiderar"
                            >
                              <EyeOff size={15} />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>
              )}

              {/* Desconsiderados (discreto) */}
              {computed.ignoredEvents.length > 0 && (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setShowIgnored((v) => !v)}
                    className="text-xs font-semibold text-brand-muted hover:text-primary inline-flex items-center gap-1.5"
                  >
                    <EyeOff size={14} />
                    {showIgnored ? 'Ocultar' : 'Mostrar'} atendimentos desconsiderados ({computed.ignoredEvents.length})
                  </button>

                  {showIgnored && (
                    <div className="bg-white rounded-2xl border border-brand-border p-4 divide-y divide-brand-border">
                      {computed.ignoredEvents.map((ev) => (
                        <div key={ev.eventId} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                          <div>
                            <span className="font-bold text-primary">{ev.displayDate}</span> ·{' '}
                            <span className="text-brand-muted">{ev.rawSummary}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRestoreIgnored(ev.eventId)}
                            className="inline-flex items-center gap-1 text-secondary-700 font-semibold hover:text-primary"
                          >
                            <RotateCcw size={13} />
                            Restaurar
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* ABA 2: PACOTES POR PACIENTE                                    */}
          {/* ============================================================== */}
          {activeTab === 'pacientes' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex flex-col md:flex-row gap-4 justify-between">
                <div className="relative flex-1 max-w-md">
                  <Search
                    size={17}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-muted"
                  />
                  <input
                    type="search"
                    placeholder="Buscar paciente ou nome na agenda..."
                    value={searchPaciente}
                    onChange={(e) => setSearchPaciente(e.target.value)}
                    className="input-base pl-11 bg-white"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { id: 'todos', label: 'Todos' },
                      { id: 'active', label: 'Em andamento' },
                      { id: 'sem_inicio', label: 'Sem início' },
                      { id: 'renovar', label: 'Renovar' },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setPkgFilter(f.id)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors ${
                        pkgFilter === f.id
                          ? 'bg-primary text-white border-primary'
                          : 'bg-white text-brand-muted border-brand-border hover:text-primary'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pacotes sem paciente vinculado no topo da aba Pacientes */}
              {computed.unassignedPatientPackages.length > 0 && (
                <div className="bg-amber-50/70 border border-amber-200 rounded-3xl p-6 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-bold text-amber-950">
                        Pacotes sem Paciente Vinculado ({computed.unassignedPatientPackages.length})
                      </h3>
                      <p className="text-xs text-amber-800">
                        Vincule um Paciente Único ou abra as sessões para gerenciar este pacote.
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {computed.unassignedPatientPackages.map((cp) => (
                      <div
                        key={cp.pkg.id}
                        className="p-4 rounded-2xl bg-white border border-amber-200 flex items-center justify-between gap-3"
                      >
                        <div>
                          <p className="text-sm font-bold text-primary">
                            {getPackageTypeLabel(cp.pkg.package_type, cp.pkg.total_sessions)}
                            {cp.pkg.label ? ` · ${cp.pkg.label}` : ''}
                          </p>
                          <p className="text-xs text-brand-muted">
                            {cp.usedTotal}/{cp.pkg.total_sessions} sessões · Início{' '}
                            {formatISODateToBR(cp.pkg.start_date)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => openEditPackage(cp)}
                            className="btn-primary py-1.5 px-3 text-xs"
                          >
                            Vincular Paciente
                          </button>
                          <button
                            type="button"
                            onClick={() => setReportModalPkgId(cp.pkg.id)}
                            className="px-3 py-1.5 rounded-xl bg-brand-cream text-primary text-xs font-semibold"
                          >
                            Sessões
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {filteredPatientSummaries.length === 0 ? (
                <div className="bg-white rounded-3xl border border-brand-border p-12 text-center space-y-3">
                  <p className="text-sm text-brand-muted">
                    Nenhum pacote encontrado com os filtros atuais.
                  </p>
                  <button
                    type="button"
                    onClick={() => openCreatePackageFresh(null)}
                    className="btn-secondary text-xs py-2.5 px-5"
                  >
                    <Plus size={15} />
                    Criar Novo Pacote
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {filteredPatientSummaries.map((summary) => (
                    <div
                      key={summary.paciente.id}
                      className="bg-white rounded-3xl border border-brand-border shadow-card p-6 sm:p-7 space-y-5"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-2.5">
                            <h3 className="text-lg font-bold text-primary">
                              {summary.paciente.nome}
                            </h3>
                            {summary.pendingEvents.length > 0 && (
                              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                {summary.pendingEvents.length} dia(s) pendente(s)
                              </span>
                            )}
                          </div>
                          {summary.directLinks.length > 0 ? (
                            <p className="text-xs text-brand-muted mt-1">
                              Agenda vinculada:{' '}
                              {summary.directLinks.map((l) => `#${l.calendar_name}`).join(', ')}
                              {summary.groupedAliasesFromFechamento.length > 0 &&
                                ` (+ agrupados: ${summary.groupedAliasesFromFechamento.join(', ')})`}
                            </p>
                          ) : (
                            <p className="text-xs text-amber-700 mt-1">
                              Nenhum nome da agenda vinculado ainda.
                            </p>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setReportPacienteId(summary.paciente.id)
                              setActiveTab('relatorio')
                            }}
                            className="btn-outline py-2 px-3.5 text-xs"
                          >
                            <FileText size={14} />
                            Relatório Geral
                          </button>
                          <button
                            type="button"
                            onClick={() => openCreatePackageFresh(summary.paciente.id)}
                            className="btn-secondary py-2 px-3.5 text-xs"
                          >
                            <Plus size={14} />
                            Novo Pacote
                          </button>
                        </div>
                      </div>

                      {summary.packages.length > 0 && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {summary.packages.map((cp) => {
                            const pct = Math.min(
                              100,
                              Math.round((cp.usedTotal / cp.pkg.total_sessions) * 100)
                            )
                            return (
                              <div
                                key={cp.pkg.id}
                                className="p-5 rounded-2xl border border-brand-border bg-brand-offwhite space-y-4"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="font-bold text-sm text-primary">
                                        {getPackageTypeLabel(cp.pkg.package_type, cp.pkg.total_sessions)}
                                      </span>
                                      {cp.pkg.label && (
                                        <span className="px-2 py-0.5 rounded-full bg-white border border-brand-border text-[11px] font-semibold text-primary">
                                          {cp.pkg.label}
                                        </span>
                                      )}
                                      {cp.needsStartDate ? (
                                        <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold">
                                          Sem início definido
                                        </span>
                                      ) : cp.isNearEnd ? (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-secondary-100 text-secondary-800 text-[11px] font-bold">
                                          <Sparkles size={11} />
                                          {cp.remainingCount === 0 ? 'Concluído · Renovar' : 'Última sessão'}
                                        </span>
                                      ) : (
                                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold">
                                          Em andamento
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-brand-muted mt-1">
                                      Início: <strong>{formatISODateToBR(cp.pkg.start_date)}</strong> ·{' '}
                                      {formatBRL(cp.pkg.session_price)}/sessão (Total{' '}
                                      {formatBRL(cp.totalValue)})
                                    </p>
                                  </div>

                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => openEditPackage(cp)}
                                      className="p-2 rounded-xl hover:bg-white text-brand-muted hover:text-primary"
                                      title="Editar pacote"
                                    >
                                      <Pencil size={14} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeletePackage(cp)}
                                      className="p-2 rounded-xl hover:bg-red-50 text-brand-muted hover:text-red-600"
                                      title="Excluir pacote"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>

                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between text-xs font-semibold">
                                    <span className="text-primary">
                                      {cp.usedTotal} / {cp.pkg.total_sessions} ({cp.completedCount} feitas
                                      {cp.scheduledFutureCount > 0 ? `, ${cp.scheduledFutureCount} agendadas` : ''})
                                    </span>
                                    <span className="text-secondary-700">
                                      Faltam {cp.remainingCount}
                                    </span>
                                  </div>
                                  <div className="h-2 w-full rounded-full bg-white border border-brand-border overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${
                                        cp.pkg.status === 'completed'
                                          ? 'bg-emerald-500'
                                          : 'bg-secondary-600'
                                      }`}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                </div>

                                <div className="flex items-center justify-between pt-1">
                                  <span className="text-[11px] font-semibold text-brand-muted">
                                    {cp.pkg.is_paid ? 'Pago' : 'Em aberto'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setReportModalPkgId(cp.pkg.id)}
                                    className="text-xs font-bold text-primary hover:text-secondary-700 inline-flex items-center gap-1"
                                  >
                                    Gerenciar Sessões &amp; Relatório →
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* ABA 3: VINCULAR AGENDA (1 PARA N)                              */}
          {/* ============================================================== */}
          {activeTab === 'vinculos' && (
            <div className="space-y-8 animate-fade-in">
              {/* Nomes da agenda ainda livres */}
              <section className="bg-white rounded-3xl border border-brand-border shadow-card p-6 sm:p-8 space-y-5">
                <div>
                  <h2 className="text-lg font-bold text-primary">
                    Nomes da Agenda ainda sem Paciente Único ({computed.unlinkedGroups.length})
                  </h2>
                  <p className="text-xs text-brand-muted mt-0.5">
                    Vincule cada nome vindo do Google Calendar ao Paciente Único da Avaliação. Vários nomes agrupados podem ser vinculados ao mesmo paciente (1 para N).
                  </p>
                </div>

                {computed.unlinkedGroups.length === 0 ? (
                  <div className="p-6 rounded-2xl bg-emerald-50/60 border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center gap-2.5">
                    <UserCheck size={18} />
                    Todos os nomes da agenda a partir de Nov/2026 já estão vinculados!
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {computed.unlinkedGroups.map((g) => (
                      <div
                        key={g.calendarName}
                        className="p-4 rounded-2xl border border-brand-border bg-brand-offwhite flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-primary truncate">
                            #{g.calendarName}
                          </p>
                          <p className="text-[11px] text-brand-muted mt-0.5">
                            {g.cutoffEventsCount} sessão(ões) · {g.sampleDates.slice(0, 2).join(', ')}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => openLinkModal([g.calendarName])}
                          className="btn-primary py-2 px-3 text-xs flex-shrink-0"
                        >
                          <Link2 size={13} />
                          Vincular
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Lista de Pacientes Únicos e seus múltiplos nomes (1 para N) */}
              <section className="bg-white rounded-3xl border border-brand-border shadow-card p-6 sm:p-8 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-primary">
                      Pacientes Únicos e Nomes Vinculados (1 para N)
                    </h2>
                    <p className="text-xs text-brand-muted mt-0.5">
                      Enxergue todos os nomes da agenda e agrupamentos associados a cada paciente cadastrado.
                    </p>
                  </div>

                  <div className="relative w-full sm:w-72">
                    <Search
                      size={16}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-muted"
                    />
                    <input
                      type="search"
                      placeholder="Filtrar paciente ou apelido..."
                      value={searchLinkPaciente}
                      onChange={(e) => setSearchLinkPaciente(e.target.value)}
                      className="input-base pl-10 bg-brand-offwhite"
                    />
                  </div>
                </div>

                <div className="divide-y divide-brand-border border border-brand-border rounded-2xl overflow-hidden">
                  {filteredLinkPatientSummaries.map((s) => (
                    <div key={s.paciente.id} className="p-4 sm:p-5 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <button
                            type="button"
                            onClick={() => navigate(`/pacientes/${s.paciente.id}`)}
                            className="text-sm sm:text-base font-bold text-primary hover:text-secondary-700 text-left"
                          >
                            {s.paciente.nome}
                          </button>
                          <p className="text-xs text-brand-muted">{s.paciente.telefone}</p>
                        </div>

                        <div className="flex items-center gap-2">
                          {addingAliasForPacienteId === s.paciente.id ? (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                autoFocus
                                placeholder="Nome exato na agenda..."
                                value={customAliasInput}
                                onChange={(e) => setCustomAliasInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleAddCustomAlias(s.paciente.id)
                                  if (e.key === 'Escape') setAddingAliasForPacienteId(null)
                                }}
                                className="px-3 py-1.5 rounded-xl border border-secondary text-xs text-primary focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleAddCustomAlias(s.paciente.id)}
                                className="btn-secondary py-1.5 px-3 text-xs"
                              >
                                Salvar
                              </button>
                              <button
                                type="button"
                                onClick={() => setAddingAliasForPacienteId(null)}
                                className="p-1.5 text-brand-muted hover:text-primary"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setAddingAliasForPacienteId(s.paciente.id)
                                setCustomAliasInput('')
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-cream hover:bg-secondary-100 text-primary text-xs font-semibold transition-colors"
                            >
                              <Plus size={14} />
                              Adicionar nome da agenda
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {s.directLinks.length === 0 ? (
                          <span className="text-xs text-brand-muted italic">
                            Nenhum nome vinculado ainda
                          </span>
                        ) : (
                          s.directLinks.map((l) => (
                            <span
                              key={l.id}
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-50 text-primary border border-primary-100 text-xs font-semibold"
                            >
                              #{l.calendar_name}
                              <button
                                type="button"
                                onClick={() => handleUnlinkName(l.id, l.calendar_name)}
                                className="hover:text-red-600 transition-colors"
                                title="Desvincular nome"
                              >
                                <Unlink size={12} />
                              </button>
                            </span>
                          ))
                        )}

                        {s.groupedAliasesFromFechamento.map((alias) => (
                          <span
                            key={alias}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-secondary-50 text-secondary-800 border border-secondary-200 text-xs font-medium"
                            title="Agrupado automaticamente via Fechamento"
                          >
                            Agrupado: #{alias}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {/* ============================================================== */}
          {/* ABA 4: RELATÓRIO POR PACIENTE                                  */}
          {/* ============================================================== */}
          {activeTab === 'relatorio' && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-white rounded-3xl border border-brand-border shadow-card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex-1 max-w-md space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-brand-muted">
                    Selecionar Paciente para Relatório
                  </label>
                  <select
                    value={selectedReportPatientSummary?.paciente.id || ''}
                    onChange={(e) => setReportPacienteId(e.target.value)}
                    className="input-base"
                  >
                    <option value="">Escolha um paciente...</option>
                    {computed.patientSummaries
                      .slice()
                      .sort((a, b) => a.paciente.nome.localeCompare(b.paciente.nome))
                      .map((s) => (
                        <option key={s.paciente.id} value={s.paciente.id}>
                          {s.paciente.nome} ({s.packages.length} pacote{s.packages.length === 1 ? '' : 's'})
                        </option>
                      ))}
                  </select>
                </div>

                {selectedReportPatientSummary && (
                  <button
                    type="button"
                    disabled={exportingFullReport}
                    onClick={handleExportFullPatientReport}
                    className="btn-primary py-3 px-5 text-xs self-start sm:self-end"
                  >
                    {exportingFullReport ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Download size={15} />
                    )}
                    Exportar Relatório PDF
                  </button>
                )}
              </div>

              {selectedReportPatientSummary ? (
                <div
                  id="relatorio-completo-paciente"
                  className="bg-white rounded-3xl border border-brand-border shadow-card p-6 sm:p-8 space-y-8"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-brand-border">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-secondary-600">
                        Go Fisioterapia · Relatório de Pacotes
                      </p>
                      <h2 className="text-2xl font-bold text-primary mt-1">
                        {selectedReportPatientSummary.paciente.nome}
                      </h2>
                      <p className="text-xs text-brand-muted mt-1">
                        {selectedReportPatientSummary.paciente.telefone} · Nomes na agenda:{' '}
                        {selectedReportPatientSummary.directLinks.length > 0
                          ? selectedReportPatientSummary.directLinks
                              .map((l) => `#${l.calendar_name}`)
                              .join(', ')
                          : 'Nenhum vínculo'}
                      </p>
                    </div>
                  </div>

                  {selectedReportPatientSummary.packages.length === 0 ? (
                    <div className="py-10 text-center space-y-3">
                      <p className="text-sm text-brand-muted">
                        Este paciente ainda não possui pacotes cadastrados.
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          openCreatePackageFresh(selectedReportPatientSummary.paciente.id)
                        }
                        className="btn-secondary text-xs py-2.5 px-5"
                      >
                        <Plus size={14} />
                        Criar Pacote para Este Paciente
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-8">
                      {selectedReportPatientSummary.packages.map((cp) => (
                        <div
                          key={cp.pkg.id}
                          className="rounded-3xl border border-brand-border p-6 space-y-5"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                              <h3 className="text-lg font-bold text-primary">
                                {getPackageTypeLabel(cp.pkg.package_type, cp.pkg.total_sessions)}
                                {cp.pkg.label ? ` — ${cp.pkg.label}` : ''}
                              </h3>
                              <p className="text-xs text-brand-muted mt-1">
                                Início: <strong>{formatISODateToBR(cp.pkg.start_date)}</strong> ·{' '}
                                {cp.usedTotal} de {cp.pkg.total_sessions} usadas ({cp.completedCount}{' '}
                                realizadas, {cp.scheduledFutureCount} agendadas, faltam {cp.remainingCount})
                              </p>
                            </div>

                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <p className="text-xs text-brand-muted">
                                  {formatBRL(cp.pkg.session_price)} / sessão
                                </p>
                                <p className="text-base font-bold text-primary">
                                  Total: {formatBRL(cp.totalValue)}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => setReportModalPkgId(cp.pkg.id)}
                                className="btn-outline py-2 px-3.5 text-xs"
                              >
                                Editar Sessões
                              </button>
                            </div>
                          </div>

                          <div className="border border-brand-border rounded-2xl overflow-hidden">
                            <table className="w-full text-left border-collapse text-xs sm:text-sm">
                              <thead>
                                <tr className="bg-brand-cream border-b border-brand-border text-[11px] font-semibold uppercase tracking-wider text-brand-muted">
                                  <th className="py-3 px-4">Sessão</th>
                                  <th className="py-3 px-4">Data</th>
                                  <th className="py-3 px-4">Evento na Agenda</th>
                                  <th className="py-3 px-4 text-right">Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-brand-border">
                                {cp.pkg.initial_offset > 0 && (
                                  <tr className="bg-brand-offwhite/70">
                                    <td className="py-3 px-4 font-bold text-primary">
                                      1 a {cp.pkg.initial_offset}/{cp.pkg.total_sessions}
                                    </td>
                                    <td className="py-3 px-4 text-brand-muted">Anteriores</td>
                                    <td className="py-3 px-4 text-brand-muted">
                                      Histórico inicial informado na criação do pacote
                                    </td>
                                    <td className="py-3 px-4 text-right">
                                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold">
                                        Realizada
                                      </span>
                                    </td>
                                  </tr>
                                )}
                                {cp.sessions.length === 0 && cp.pkg.initial_offset === 0 ? (
                                  <tr>
                                    <td colSpan={4} className="py-6 text-center text-brand-muted">
                                      Nenhuma sessão vinculada ainda.
                                    </td>
                                  </tr>
                                ) : (
                                  cp.sessions.map((s) => (
                                    <tr key={s.id}>
                                      <td className="py-3 px-4 font-bold text-primary">
                                        {s.sessionNumber}/{cp.pkg.total_sessions}
                                      </td>
                                      <td className="py-3 px-4 font-medium text-primary">
                                        {s.displayDate}
                                      </td>
                                      <td className="py-3 px-4 text-brand-body">
                                        {s.calendar_summary}
                                      </td>
                                      <td className="py-3 px-4 text-right">
                                        <span
                                          className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                            s.isCompleted
                                              ? 'bg-emerald-50 text-emerald-700'
                                              : 'bg-sky-50 text-sky-700'
                                          }`}
                                        >
                                          {s.isCompleted ? 'Realizada' : 'Agendada'}
                                        </span>
                                      </td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white rounded-3xl border border-brand-border p-12 text-center text-sm text-brand-muted">
                  Selecione um paciente acima para visualizar o relatório de pacotes.
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Modais */}
      <CreateOrEditPackageModal
        isOpen={pkgModalOpen}
        onClose={() => setPkgModalOpen(false)}
        onSaved={(msg) => {
          showToast(msg)
          loadData(undefined, true)
        }}
        pacientes={pacientes}
        allEvents={computed?.resolvedEvents || []}
        editingPackage={editingPkg}
        seedPacienteId={seedPacienteId}
        seedEvent={seedEvent}
      />

      <LinkCalendarModal
        isOpen={linkModalOpen}
        onClose={() => setLinkModalOpen(false)}
        onLinked={(msg) => {
          showToast(msg)
          loadData(undefined, true)
        }}
        pacientes={pacientes}
        calendarNames={linkModalNames}
        defaultPacienteId={linkModalDefaultPacienteId}
      />

      <PackageReportModal
        isOpen={Boolean(reportModalPkgId)}
        onClose={() => setReportModalPkgId(null)}
        onChanged={(msg) => {
          showToast(msg)
          loadData(undefined, true)
        }}
        computedPkg={reportModalComputedPkg}
        otherPatientPackages={reportModalOtherPackages}
        allActivePackages={allActivePackages}
        pacientes={pacientes}
        patientPendingAndLegacyEvents={reportModalFreeEvents}
        linkedCalendarNames={reportModalLinkedNames}
        onOpenAgendaPicker={(replacingSession) => {
          if (!reportModalComputedPkg) return
          setAgendaPickerPkgId(reportModalComputedPkg.pkg.id)
          setAgendaPickerReplacingSession(replacingSession)
        }}
        onEditPackage={(cp) => openEditPackage(cp)}
        onDeletePackage={(cp) => handleDeletePackage(cp)}
      />

      <PackageAgendaPickerModal
        isOpen={Boolean(agendaPickerPkgId)}
        onClose={() => {
          setAgendaPickerPkgId(null)
          setAgendaPickerReplacingSession(null)
        }}
        onChanged={(msg) => {
          showToast(msg)
          loadData(undefined, true)
        }}
        targetPackage={agendaPickerTargetPkg}
        replacingSession={agendaPickerReplacingSession}
        initialDate={
          agendaPickerReplacingSession?.event_date ||
          selectedWeekStart ||
          overview?.today
        }
        allComputedPackages={computed?.allComputedPackages || []}
        allLinks={overview?.links || []}
        pacientes={pacientes}
      />

      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-white text-xs font-semibold shadow-xl animate-slide-up ${
            toast.err ? 'bg-red-600' : 'bg-primary'
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  )
}
