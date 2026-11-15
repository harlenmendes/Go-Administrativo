import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ExternalLink,
  FileSpreadsheet,
  Link2,
  Loader2,
  Merge,
  Pencil,
  Plus,
  RotateCcw,
  Settings2,
  Trash2,
  Undo2,
  Unlink,
  Users,
  X,
} from 'lucide-react'
import {
  deleteSavedPrice,
  disconnectGoogle,
  exportFechamentoToSheets,
  fetchCalendarAtendimentos,
  fetchSavedMappings,
  fetchSavedPrices,
  getGoogleAuthStatus,
  getGoogleConnectUrl,
  GoogleAuthRequiredError,
  resetMonthMappings,
  saveMapping,
  savePrice,
  syncMappings,
  syncPrices,
  type CalendarPatientRaw,
  type FechamentoPatientRow,
  type GoogleAuthStatus,
  type MappingsByMonth,
  type PricesMap,
} from '@/lib/fechamentoApi'

interface UndoHistoryEntry {
  description: string
  affectedMonths: string[]
  previousMappingsByMonth: Record<string, Record<string, string>>
}

interface ToastState {
  message: string
  isError: boolean
}

function formatBRL(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}`
}

function getCurrentMonthStr(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function getNextMonthStr(baseMonth: string): string {
  const [yStr, mStr] = baseMonth.split('-')
  let year = parseInt(yStr, 10)
  let month = parseInt(mStr, 10) + 1
  if (month > 12) {
    month = 1
    year += 1
  }
  return `${year}-${String(month).padStart(2, '0')}`
}

export function Fechamento() {
  const navigate = useNavigate()

  // Estado de conexão Google e dados do banco
  const [googleStatus, setGoogleStatus] = useState<GoogleAuthStatus | null>(null)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [dbPrices, setDbPrices] = useState<PricesMap>({})
  const [dbMappings, setDbMappings] = useState<MappingsByMonth>({})

  // Seleção de meses e atendimentos
  const [months, setMonths] = useState<string[]>([getCurrentMonthStr()])
  const [rawPatients, setRawPatients] = useState<CalendarPatientRaw[]>([])
  const [patientsData, setPatientsData] = useState<Record<string, FechamentoPatientRow>>({})
  const [hasResults, setHasResults] = useState(false)
  const [isFetching, setIsFetching] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [sheetUrl, setSheetUrl] = useState<string | null>(null)

  // Seleção em lote e edição inline
  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set())
  const [editingRowName, setEditingRowName] = useState<string | null>(null)
  const [editingRowInput, setEditingRowInput] = useState('')

  // Fila de preços pendentes
  const [pendingPrices, setPendingPrices] = useState<CalendarPatientRaw[]>([])
  const [pendingPriceInput, setPendingPriceInput] = useState('')

  // Modal Gerenciar Valores
  const [showManagePrices, setShowManagePrices] = useState(false)
  const [editingPriceKey, setEditingPriceKey] = useState<string | null>(null)
  const [editingPriceVal, setEditingPriceVal] = useState('')

  // Modal Agrupar
  const [mergeSources, setMergeSources] = useState<string[]>([])
  const [mergeTarget, setMergeTarget] = useState('')

  // Histórico Desfazer + Toast
  const [undoStack, setUndoStack] = useState<UndoHistoryEntry[]>([])
  const [toast, setToast] = useState<ToastState | null>(null)

  const showToast = useCallback((message: string, isError = false) => {
    setToast({ message, isError })
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev))
    }, 3200)
  }, [])

  // Carrega status Google + preços e mapeamentos do Supabase via API
  useEffect(() => {
    let active = true
    async function init() {
      try {
        const [status, prices, mappings] = await Promise.all([
          getGoogleAuthStatus().catch(() => ({ authenticated: false, googleConnected: false })),
          fetchSavedPrices().catch(() => ({})),
          fetchSavedMappings().catch(() => ({})),
        ])

        if (!active) return
        setGoogleStatus(status)

        // Migração transparente de dados antigos no localStorage, se existirem
        const mergedPrices: PricesMap = { ...prices }
        const localPrices = JSON.parse(localStorage.getItem('patientPrices') || '{}')
        let needsSyncPrices = false
        for (const [k, v] of Object.entries(localPrices)) {
          if (mergedPrices[k] === undefined && typeof v === 'number') {
            mergedPrices[k] = v
            needsSyncPrices = true
          }
        }
        if (needsSyncPrices) {
          syncPrices(mergedPrices).catch(() => {})
        }

        const mergedMappings: MappingsByMonth = { ...mappings }
        const localMappings = JSON.parse(localStorage.getItem('patientNameMappings') || '{}')
        let needsSyncMappings = false
        for (const [m, monthMap] of Object.entries(localMappings)) {
          if (monthMap && typeof monthMap === 'object') {
            if (!mergedMappings[m]) mergedMappings[m] = {}
            for (const [oldN, newN] of Object.entries(monthMap as Record<string, string>)) {
              if (!mergedMappings[m][oldN]) {
                mergedMappings[m][oldN] = newN
                needsSyncMappings = true
              }
            }
          }
        }
        if (needsSyncMappings) {
          syncMappings(mergedMappings).catch(() => {})
        }

        setDbPrices(mergedPrices)
        setDbMappings(mergedMappings)
      } finally {
        if (active) setCheckingAuth(false)
      }
    }
    init()
    return () => {
      active = false
    }
  }, [])

  const sortedValidMonths = useMemo(() => {
    const unique = Array.from(new Set(months.map((m) => m.trim()).filter(Boolean)))
    unique.sort()
    return unique
  }, [months])

  // Processa a lista vinda do Google Calendar aplicando mapeamentos e preços
  const processPatients = useCallback(
    (
      rawList: CalendarPatientRaw[],
      pricesMap: PricesMap,
      mappingsByMonth: MappingsByMonth,
      activeMonths: string[],
      previousRows: Record<string, FechamentoPatientRow>
    ) => {
      const combinedMap: Record<string, string> = {}
      activeMonths.forEach((m) => {
        const mMap = mappingsByMonth[m] || {}
        Object.entries(mMap).forEach(([oldN, newN]) => {
          combinedMap[oldN] = newN
        })
      })

      const aggregated: Record<string, CalendarPatientRaw> = {}
      rawList.forEach((p) => {
        const targetName = combinedMap[p.name] || p.name
        if (!aggregated[targetName]) {
          aggregated[targetName] = { name: targetName, count: 0, dates: [] }
        }
        aggregated[targetName].count += p.count
        if (p.dates) {
          aggregated[targetName].dates = aggregated[targetName].dates.concat(p.dates)
        }
      })

      Object.values(aggregated).forEach((item) => item.dates.sort())

      const nextRows: Record<string, FechamentoPatientRow> = {}
      const missing: CalendarPatientRaw[] = []

      Object.values(aggregated).forEach((item) => {
        const prev = previousRows[item.name]
        const statusPago = prev ? prev.statusPago : 'Não'
        const valorRecebido = prev ? prev.valorRecebido : 0

        if (pricesMap[item.name] !== undefined) {
          nextRows[item.name] = {
            name: item.name,
            count: item.count,
            price: Number(pricesMap[item.name]),
            statusPago,
            valorRecebido,
            dates: item.dates,
          }
        } else {
          missing.push(item)
        }
      })

      setPatientsData(nextRows)
      setPendingPrices(missing)
      setPendingPriceInput('')
      setHasResults(true)
    },
    []
  )

  const handleAddMonth = () => {
    const base =
      sortedValidMonths.length > 0
        ? sortedValidMonths[sortedValidMonths.length - 1]
        : getCurrentMonthStr()
    setMonths((prev) => [...prev, getNextMonthStr(base)])
  }

  const handleMonthChange = (idx: number, value: string) => {
    setMonths((prev) => prev.map((m, i) => (i === idx ? value : m)))
  }

  const handleRemoveMonth = (idx: number) => {
    setMonths((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleFetchAtendimentos = async () => {
    if (sortedValidMonths.length === 0) return
    setIsFetching(true)
    setSheetUrl(null)
    setSelectedNames(new Set())

    try {
      const list = await fetchCalendarAtendimentos(sortedValidMonths)
      setRawPatients(list)
      processPatients(list, dbPrices, dbMappings, sortedValidMonths, patientsData)
      if (list.length === 0) {
        showToast('Nenhum atendimento encontrado nos meses selecionados.')
      }
    } catch (err) {
      if (err instanceof GoogleAuthRequiredError) {
        setGoogleStatus((prev) => ({ ...(prev || { authenticated: false }), googleConnected: false }))
        showToast('Conecte sua conta Google Agenda para importar os atendimentos.', true)
      } else {
        showToast(err instanceof Error ? err.message : 'Erro ao buscar agenda.', true)
      }
    } finally {
      setIsFetching(false)
    }
  }

  // Salvar preço pendente do modal sequencial
  const handleSavePendingPrice = async () => {
    if (pendingPrices.length === 0) return
    const val = parseFloat(pendingPriceInput)
    if (isNaN(val) || val < 0) {
      alert('Informe um valor válido.')
      return
    }
    const current = pendingPrices[0]
    const updatedPrices = { ...dbPrices, [current.name]: val }
    setDbPrices(updatedPrices)
    localStorage.setItem('patientPrices', JSON.stringify(updatedPrices))

    try {
      await savePrice(current.name, val)
    } catch (e) {
      console.error(e)
    }

    setPatientsData((prev) => ({
      ...prev,
      [current.name]: {
        name: current.name,
        count: current.count,
        price: val,
        statusPago: 'Não',
        valorRecebido: 0,
        dates: current.dates || [],
      },
    }))
    setPendingPrices((prev) => prev.slice(1))
    setPendingPriceInput('')
  }

  // Edição e exclusão no modal "Gerenciar Valores"
  const handleSaveManagedPrice = async (name: string) => {
    const val = parseFloat(editingPriceVal)
    setEditingPriceKey(null)
    if (isNaN(val) || val < 0) {
      alert('Informe um valor válido.')
      return
    }
    const updatedPrices = { ...dbPrices, [name]: val }
    setDbPrices(updatedPrices)
    localStorage.setItem('patientPrices', JSON.stringify(updatedPrices))
    await savePrice(name, val).catch(console.error)

    setPatientsData((prev) => {
      if (!prev[name]) return prev
      return {
        ...prev,
        [name]: { ...prev[name], price: val },
      }
    })
    showToast(`Valor de ${name} atualizado!`)
  }

  const handleDeleteManagedPrice = async (name: string) => {
    if (!confirm(`Tem certeza que deseja excluir o valor salvo de ${name}?`)) return
    const next = { ...dbPrices }
    delete next[name]
    setDbPrices(next)
    localStorage.setItem('patientPrices', JSON.stringify(next))
    await deleteSavedPrice(name).catch(console.error)
    showToast(`Valor de ${name} removido!`)
  }

  // Aplica e persiste mapeamento (renomear ou agrupar)
  const applyMonthlyMapping = async (
    currentMap: MappingsByMonth,
    monthKey: string,
    oldName: string,
    newName: string
  ): Promise<MappingsByMonth> => {
    const updatedMonth = { ...(currentMap[monthKey] || {}) }
    Object.keys(updatedMonth).forEach((k) => {
      if (updatedMonth[k] === oldName) {
        updatedMonth[k] = newName
      }
    })
    updatedMonth[oldName] = newName

    const nextMap = { ...currentMap, [monthKey]: updatedMonth }
    localStorage.setItem('patientNameMappings', JSON.stringify(nextMap))
    await saveMapping(monthKey, oldName, newName).catch(console.error)
    return nextMap
  }

  // Renomear paciente inline na tabela
  const handleCommitInlineRename = async (oldName: string) => {
    const rawName = editingRowInput.trim()
    setEditingRowName(null)

    if (!rawName || rawName.toLowerCase() === oldName.toLowerCase()) return
    const newName = rawName.charAt(0).toUpperCase() + rawName.slice(1).toLowerCase()

    if (patientsData[newName] && newName !== oldName) {
      alert("Já existe um paciente com esse nome na lista! Use a opção 'Agrupar' para juntá-los.")
      return
    }

    let nextPrices = dbPrices
    if (dbPrices[oldName] !== undefined && dbPrices[newName] === undefined) {
      nextPrices = { ...dbPrices, [newName]: dbPrices[oldName] }
      setDbPrices(nextPrices)
      localStorage.setItem('patientPrices', JSON.stringify(nextPrices))
      await savePrice(newName, dbPrices[oldName]).catch(console.error)
    }

    const prevSnapshot: Record<string, Record<string, string>> = {}
    sortedValidMonths.forEach((m) => {
      prevSnapshot[m] = { ...(dbMappings[m] || {}) }
    })

    let nextMappings = dbMappings
    for (const m of sortedValidMonths) {
      nextMappings = await applyMonthlyMapping(nextMappings, m, oldName, newName)
    }
    setDbMappings(nextMappings)

    setUndoStack((prev) => [
      ...prev,
      {
        description: `Renomeou '${oldName}' para '${newName}'`,
        affectedMonths: sortedValidMonths,
        previousMappingsByMonth: prevSnapshot,
      },
    ])

    processPatients(rawPatients, nextPrices, nextMappings, sortedValidMonths, patientsData)
  }

  // Agrupar pacientes (individual ou em lote)
  const openMergeFor = (sources: string[]) => {
    const availableTargets = Object.keys(patientsData)
      .sort()
      .filter((n) => !sources.includes(n))
    if (availableTargets.length === 0) {
      alert('Não há outros pacientes disponíveis na lista para agrupar.')
      return
    }
    setMergeSources(sources)
    setMergeTarget(availableTargets[0])
  }

  const handleConfirmMerge = async () => {
    if (mergeSources.length === 0 || !mergeTarget) return

    const prevSnapshot: Record<string, Record<string, string>> = {}
    sortedValidMonths.forEach((m) => {
      prevSnapshot[m] = { ...(dbMappings[m] || {}) }
    })

    let nextMappings = dbMappings
    for (const src of mergeSources) {
      for (const m of sortedValidMonths) {
        nextMappings = await applyMonthlyMapping(nextMappings, m, src, mergeTarget)
      }
    }
    setDbMappings(nextMappings)

    const desc =
      mergeSources.length === 1
        ? `Agrupou '${mergeSources[0]}' em '${mergeTarget}'`
        : `Agrupou ${mergeSources.length} pacientes em '${mergeTarget}'`

    setUndoStack((prev) => [
      ...prev,
      {
        description: desc,
        affectedMonths: sortedValidMonths,
        previousMappingsByMonth: prevSnapshot,
      },
    ])

    setMergeSources([])
    setSelectedNames(new Set())
    showToast(desc)
    processPatients(rawPatients, dbPrices, nextMappings, sortedValidMonths, patientsData)
  }

  // Desfazer última ação
  const handleUndoLast = async () => {
    if (undoStack.length === 0) return
    const last = undoStack[undoStack.length - 1]
    setUndoStack((prev) => prev.slice(0, -1))

    const nextMappings = { ...dbMappings }
    for (const m of last.affectedMonths) {
      const prevMap = last.previousMappingsByMonth[m] || {}
      await resetMonthMappings(m).catch(console.error)
      if (Object.keys(prevMap).length > 0) {
        nextMappings[m] = prevMap
        for (const [oldN, newN] of Object.entries(prevMap)) {
          await saveMapping(m, oldN, newN).catch(console.error)
        }
      } else {
        delete nextMappings[m]
      }
    }
    localStorage.setItem('patientNameMappings', JSON.stringify(nextMappings))
    setDbMappings(nextMappings)
    setSelectedNames(new Set())
    showToast(`Desfeito: ${last.description}`)
    processPatients(rawPatients, dbPrices, nextMappings, sortedValidMonths, patientsData)
  }

  // Resetar todos os agrupamentos e renomeações dos meses selecionados
  const handleResetAllMappings = async () => {
    if (sortedValidMonths.length === 0) return
    if (
      !confirm(
        'Tem certeza que deseja desfazer todos os agrupamentos e renomeações dos meses selecionados e voltar aos nomes originais do Google Calendar?'
      )
    ) {
      return
    }
    const nextMappings = { ...dbMappings }
    for (const m of sortedValidMonths) {
      delete nextMappings[m]
      await resetMonthMappings(m).catch(console.error)
    }
    localStorage.setItem('patientNameMappings', JSON.stringify(nextMappings))
    setDbMappings(nextMappings)
    setUndoStack((prev) =>
      prev.filter((item) => !item.affectedMonths.some((m) => sortedValidMonths.includes(m)))
    )
    setSelectedNames(new Set())
    showToast('Agrupamentos e renomeações foram desfeitos!')
    processPatients(rawPatients, dbPrices, nextMappings, sortedValidMonths, {})
  }

  // Status de pagamento e valor recebido
  const handleStatusChange = (name: string, newStatus: 'Não' | 'Sim' | 'Parcial') => {
    setPatientsData((prev) => {
      const item = prev[name]
      if (!item) return prev
      const subtotal = item.count * item.price
      let valorRecebido = item.valorRecebido
      if (newStatus === 'Sim') valorRecebido = subtotal
      else if (newStatus === 'Não') valorRecebido = 0
      else if (newStatus === 'Parcial' && (valorRecebido === 0 || valorRecebido === subtotal)) {
        valorRecebido = subtotal / 2
      }
      return {
        ...prev,
        [name]: { ...item, statusPago: newStatus, valorRecebido },
      }
    })
  }

  const handleValorRecebidoChange = (name: string, rawVal: string) => {
    const val = parseFloat(rawVal)
    if (isNaN(val) || val < 0) return
    setPatientsData((prev) => {
      const item = prev[name]
      if (!item) return prev
      return { ...prev, [name]: { ...item, valorRecebido: val } }
    })
  }

  const handleRemovePatientRow = (name: string) => {
    if (!confirm(`Tem certeza que deseja remover '${name}' desta lista de fechamento?`)) return
    setPatientsData((prev) => {
      const next = { ...prev }
      delete next[name]
      return next
    })
    setSelectedNames((prev) => {
      const next = new Set(prev)
      next.delete(name)
      return next
    })
    showToast(`${name} removido da lista!`)
  }

  const handleExportSheets = async () => {
    setIsExporting(true)
    try {
      const { url } = await exportFechamentoToSheets(
        sortedValidMonths,
        Object.values(patientsData)
      )
      setSheetUrl(url)
      showToast('Planilha gerada com sucesso no Google Sheets!')
    } catch (err) {
      if (err instanceof GoogleAuthRequiredError) {
        showToast('Reconecte sua conta Google para gerar a planilha.', true)
      } else {
        showToast(err instanceof Error ? err.message : 'Erro ao exportar planilha.', true)
      }
    } finally {
      setIsExporting(false)
    }
  }

  const handleDisconnectGoogle = async () => {
    await disconnectGoogle().catch(console.error)
    setGoogleStatus({ authenticated: false, googleConnected: false })
    showToast('Conta Google desconectada.')
  }

  const sortedPatientNames = useMemo(() => Object.keys(patientsData).sort(), [patientsData])

  const totals = useMemo(() => {
    let patientsCount = 0
    let attendancesCount = 0
    let expectedValue = 0
    let receivedValue = 0
    sortedPatientNames.forEach((name) => {
      const row = patientsData[name]
      patientsCount += 1
      attendancesCount += row.count
      expectedValue += row.count * row.price
      receivedValue += row.valorRecebido
    })
    return { patientsCount, attendancesCount, expectedValue, receivedValue }
  }, [patientsData, sortedPatientNames])

  const allSelected =
    sortedPatientNames.length > 0 && selectedNames.size === sortedPatientNames.length

  const toggleSelectAll = (checked: boolean) => {
    if (checked) setSelectedNames(new Set(sortedPatientNames))
    else setSelectedNames(new Set())
  }

  const toggleRowSelect = (name: string, checked: boolean) => {
    setSelectedNames((prev) => {
      const next = new Set(prev)
      if (checked) next.add(name)
      else next.delete(name)
      return next
    })
  }

  return (
    <div className="min-h-full bg-background animate-fade-in">
      {/* Header do Módulo */}
      <header className="bg-gradient-to-br from-primary-800 via-primary to-primary-500 text-white px-5 sm:px-6 pt-5 pb-8 rounded-b-[2rem] shadow-sm relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-72 h-72 bg-secondary/20 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-6xl mx-auto relative z-10">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-secondary-300 hover:text-white transition-colors"
            >
              <ArrowLeft size={15} />
              Voltar ao Portal
            </button>
            <span className="text-[11px] font-medium tracking-[0.18em] uppercase text-secondary-300">
              Financeiro · Google Calendar
            </span>
          </div>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Fechamento de <span className="text-secondary-300">Atendimentos</span>
              </h1>
              <p className="text-primary-100/85 text-sm mt-1">
                Importe eventos do Google Calendar, confira valores e gere a planilha no Google Sheets.
              </p>
            </div>

            {/* Status da conexão Google */}
            {!checkingAuth && (
              <div className="flex items-center gap-2.5">
                {googleStatus?.googleConnected ? (
                  <div className="inline-flex items-center gap-2.5 bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl px-3.5 py-2">
                    <CheckCircle2 size={16} className="text-secondary-300 flex-shrink-0" />
                    <div className="text-left">
                      <p className="text-xs font-semibold text-white leading-tight">
                        {googleStatus.name || 'Google conectado'}
                      </p>
                      <p className="text-[11px] text-primary-200 leading-tight">
                        {googleStatus.email}
                      </p>
                    </div>
                    <button
                      onClick={handleDisconnectGoogle}
                      title="Desconectar conta Google"
                      className="ml-1 p-1.5 rounded-lg hover:bg-white/15 text-primary-100 hover:text-white transition-colors"
                    >
                      <Unlink size={14} />
                    </button>
                  </div>
                ) : (
                  <a
                    href={getGoogleConnectUrl('/fechamento')}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-primary font-semibold text-xs shadow-md hover:bg-brand-cream transition-all active:scale-95"
                  >
                    <Link2 size={15} className="text-secondary-600" />
                    Conectar Google Agenda
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 -mt-4 relative z-20 space-y-6 pb-16">
        {/* Aviso caso Google não esteja conectado ainda */}
        {!checkingAuth && !googleStatus?.googleConnected && (
          <div className="card p-5 border-l-4 border-l-secondary-600 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-secondary-50 text-secondary-700 flex items-center justify-center flex-shrink-0">
                <Calendar size={20} />
              </div>
              <div>
                <h2 className="font-semibold text-primary text-sm">
                  Conecte sua conta Google para ler a agenda
                </h2>
                <p className="text-xs text-brand-muted mt-0.5">
                  Seu login no Go Administrativo já está ativo. Agora basta autorizar a leitura do Google Calendar e a criação de planilhas no Sheets.
                </p>
              </div>
            </div>
            <a
              href={getGoogleConnectUrl('/fechamento')}
              className="btn-primary py-2.5 px-4 text-xs flex-shrink-0"
            >
              <Link2 size={15} />
              Autorizar Google
            </a>
          </div>
        )}

        {/* Painel de Controles (Meses + Ações) */}
        <div className="card p-5 sm:p-6">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
            <div className="flex-1 space-y-2.5">
              <label className="label-base text-xs uppercase tracking-wider text-brand-muted">
                Meses de Referência
              </label>
              <div className="flex flex-wrap gap-2.5">
                {months.map((m, idx) => (
                  <div key={idx} className="inline-flex items-center gap-1.5 bg-brand-cream border border-[#D1DBD6] rounded-xl px-3 py-1.5">
                    <input
                      type="month"
                      value={m}
                      onChange={(e) => handleMonthChange(idx, e.target.value)}
                      className="bg-transparent text-sm font-medium text-primary focus:outline-none"
                    />
                    {months.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMonth(idx)}
                        className="w-6 h-6 rounded-lg text-brand-muted hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition-colors"
                        title="Remover mês"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}

                <button
                  type="button"
                  onClick={handleAddMonth}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-dashed border-secondary-500 text-secondary-700 hover:bg-secondary-50 text-xs font-semibold transition-colors"
                >
                  <Plus size={15} />
                  Adicionar Mês
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setShowManagePrices(true)}
                className="btn-outline py-2.5 px-4 text-xs"
              >
                <Settings2 size={15} />
                Gerenciar Valores ({Object.keys(dbPrices).length})
              </button>

              <button
                type="button"
                onClick={handleFetchAtendimentos}
                disabled={isFetching || sortedValidMonths.length === 0}
                className="btn-secondary py-2.5 px-5 text-xs"
              >
                {isFetching ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    Buscando Agenda...
                  </>
                ) : (
                  <>
                    <Calendar size={15} />
                    Buscar Atendimentos
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Resultados */}
        {hasResults && (
          <div className="space-y-5 animate-slide-up">
            {/* Cards de Resumo */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div className="card p-4 sm:p-5">
                <p className="text-xs font-medium text-brand-muted uppercase tracking-wider">
                  Pacientes
                </p>
                <p className="text-2xl sm:text-3xl font-semibold text-primary mt-1">
                  {totals.patientsCount}
                </p>
              </div>
              <div className="card p-4 sm:p-5">
                <p className="text-xs font-medium text-brand-muted uppercase tracking-wider">
                  Atendimentos
                </p>
                <p className="text-2xl sm:text-3xl font-semibold text-primary mt-1">
                  {totals.attendancesCount}
                </p>
              </div>
              <div className="card p-4 sm:p-5">
                <p className="text-xs font-medium text-brand-muted uppercase tracking-wider">
                  Previsão Total
                </p>
                <p className="text-2xl sm:text-3xl font-semibold text-primary mt-1">
                  {formatBRL(totals.expectedValue)}
                </p>
              </div>
              <div className="card p-4 sm:p-5 bg-secondary-50/60 border-secondary-200">
                <p className="text-xs font-medium text-secondary-700 uppercase tracking-wider">
                  Já Recebido
                </p>
                <p className="text-2xl sm:text-3xl font-semibold text-secondary-800 mt-1">
                  {formatBRL(totals.receivedValue)}
                </p>
              </div>
            </div>

            {/* Barra de ações em lote */}
            {selectedNames.size > 0 && (
              <div className="card p-3.5 bg-primary-50 border-primary-200 flex flex-wrap items-center justify-between gap-3 animate-fade-in">
                <span className="text-sm font-medium text-primary">
                  <strong>{selectedNames.size}</strong> paciente(s) selecionado(s)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedNames(new Set())}
                    className="px-3 py-1.5 rounded-xl text-xs font-medium text-brand-body hover:bg-white transition-colors"
                  >
                    Limpar seleção
                  </button>
                  <button
                    type="button"
                    onClick={() => openMergeFor(Array.from(selectedNames))}
                    className="btn-secondary py-1.5 px-4 text-xs"
                  >
                    <Merge size={14} />
                    Agrupar Selecionados
                  </button>
                </div>
              </div>
            )}

            {/* Tabela de Conferência */}
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-brand-cream border-b border-brand-border text-[11px] font-semibold uppercase tracking-wider text-brand-muted">
                      <th className="py-3.5 px-4 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={(e) => toggleSelectAll(e.target.checked)}
                          className="w-4 h-4 accent-primary rounded cursor-pointer"
                          title="Selecionar Todos"
                        />
                      </th>
                      <th className="py-3.5 px-4">Paciente</th>
                      <th className="py-3.5 px-3 text-center">Sessões</th>
                      <th className="py-3.5 px-4">Valor Sessão</th>
                      <th className="py-3.5 px-4">Subtotal</th>
                      <th className="py-3.5 px-4">Pago</th>
                      <th className="py-3.5 px-4">Valor Recebido</th>
                      <th className="py-3.5 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-border text-sm">
                    {sortedPatientNames.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-10 text-center text-brand-muted">
                          <Users size={28} className="mx-auto mb-2 opacity-40" />
                          Nenhum paciente na tabela de fechamento.
                        </td>
                      </tr>
                    ) : (
                      sortedPatientNames.map((name) => {
                        const row = patientsData[name]
                        const subtotal = row.count * row.price
                        const isChecked = selectedNames.has(name)
                        const isEditingName = editingRowName === name

                        const statusStyle =
                          row.statusPago === 'Sim'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : row.statusPago === 'Parcial'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-red-50 text-red-700 border-red-200'

                        return (
                          <tr
                            key={name}
                            className={`transition-colors hover:bg-brand-offwhite ${
                              isChecked ? 'bg-secondary-50/40' : ''
                            }`}
                          >
                            <td className="py-3 px-4 text-center">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => toggleRowSelect(name, e.target.checked)}
                                className="w-4 h-4 accent-primary rounded cursor-pointer"
                              />
                            </td>

                            <td className="py-3 px-4 min-w-[200px]">
                              {isEditingName ? (
                                <input
                                  type="text"
                                  autoFocus
                                  value={editingRowInput}
                                  onChange={(e) => setEditingRowInput(e.target.value)}
                                  onBlur={() => handleCommitInlineRename(name)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleCommitInlineRename(name)
                                    if (e.key === 'Escape') setEditingRowName(null)
                                  }}
                                  className="w-full px-2.5 py-1.5 rounded-lg border border-secondary text-sm text-primary focus:outline-none focus:ring-2 focus:ring-secondary/30"
                                />
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingRowName(name)
                                    setEditingRowInput(name)
                                  }}
                                  title="Clique para renomear paciente"
                                  className="group/name inline-flex items-center gap-1.5 text-left font-semibold text-primary hover:text-secondary-700 transition-colors"
                                >
                                  <span>{name}</span>
                                  <Pencil
                                    size={12}
                                    className="opacity-0 group-hover/name:opacity-60 transition-opacity"
                                  />
                                </button>
                              )}
                            </td>

                            <td className="py-3 px-3 text-center font-medium text-primary">
                              <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-full bg-brand-cream text-xs font-semibold">
                                {row.count}
                              </span>
                            </td>

                            <td className="py-3 px-4 text-brand-body whitespace-nowrap">
                              {formatBRL(row.price)}
                            </td>

                            <td className="py-3 px-4 font-semibold text-primary whitespace-nowrap">
                              {formatBRL(subtotal)}
                            </td>

                            <td className="py-3 px-4">
                              <select
                                value={row.statusPago}
                                onChange={(e) =>
                                  handleStatusChange(
                                    name,
                                    e.target.value as 'Não' | 'Sim' | 'Parcial'
                                  )
                                }
                                className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold focus:outline-none cursor-pointer ${statusStyle}`}
                              >
                                <option value="Não">Não</option>
                                <option value="Sim">Sim</option>
                                <option value="Parcial">Parcial</option>
                              </select>
                            </td>

                            <td className="py-3 px-4 whitespace-nowrap">
                              {row.statusPago === 'Parcial' ? (
                                <div className="inline-flex items-center gap-1">
                                  <span className="text-xs text-brand-muted">R$</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    defaultValue={row.valorRecebido}
                                    onBlur={(e) => handleValorRecebidoChange(name, e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        handleValorRecebidoChange(
                                          name,
                                          (e.target as HTMLInputElement).value
                                        )
                                        ;(e.target as HTMLInputElement).blur()
                                      }
                                    }}
                                    className="w-24 px-2 py-1 rounded-lg border border-[#D1DBD6] text-xs font-medium text-primary focus:outline-none focus:border-secondary"
                                  />
                                </div>
                              ) : (
                                <span className="text-brand-body">
                                  {formatBRL(row.valorRecebido)}
                                </span>
                              )}
                            </td>

                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => openMergeFor([name])}
                                  className="px-2.5 py-1 rounded-lg bg-brand-cream hover:bg-primary hover:text-white text-primary text-xs font-medium transition-colors"
                                >
                                  Agrupar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemovePatientRow(name)}
                                  title="Remover da lista"
                                  className="p-1.5 rounded-lg text-brand-muted hover:text-red-600 hover:bg-red-50 transition-colors"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Ações finais */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={handleResetAllMappings}
                className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-red-200 bg-red-50/70 text-red-700 hover:bg-red-100 text-xs font-semibold transition-colors"
              >
                <RotateCcw size={15} />
                Desfazer Agrupamentos e Renomeações
              </button>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                {sheetUrl && (
                  <a
                    href={sheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100 text-xs font-semibold transition-colors"
                  >
                    <ExternalLink size={15} />
                    Abrir Planilha no Google Sheets
                  </a>
                )}

                <button
                  type="button"
                  onClick={handleExportSheets}
                  disabled={isExporting || sortedPatientNames.length === 0}
                  className="btn-primary py-3 px-6 text-xs"
                >
                  {isExporting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Gerando Planilha...
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet size={16} />
                      Gerar Planilha (Google Sheets)
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Botão flutuante Desfazer última alteração */}
      {undoStack.length > 0 && (
        <button
          type="button"
          onClick={handleUndoLast}
          className="fixed bottom-20 md:bottom-6 right-5 z-40 inline-flex items-center gap-2 px-4 py-3 rounded-full bg-primary text-white text-xs font-semibold shadow-xl hover:bg-primary-800 transition-all active:scale-95"
        >
          <Undo2 size={15} />
          <span>Desfazer: {undoStack[undoStack.length - 1].description}</span>
        </button>
      )}

      {/* Modal: Valor da Sessão (Pendentes) */}
      {pendingPrices.length > 0 && (
        <div className="fixed inset-0 z-50 bg-primary-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card w-full max-w-md p-6 space-y-4 animate-scale-in">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-secondary-700">
                Novo Paciente na Agenda ({pendingPrices.length} pendente{pendingPrices.length > 1 ? 's' : ''})
              </span>
              <h3 className="font-editorial text-2xl font-semibold text-primary mt-0.5">
                Valor da Sessão
              </h3>
              <p className="text-sm text-brand-body mt-1">
                Informe o valor padrão por sessão para:{' '}
                <strong className="text-primary">{pendingPrices[0].name}</strong>
              </p>
            </div>

            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-brand-muted">
                R$
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                autoFocus
                placeholder="0.00"
                value={pendingPriceInput}
                onChange={(e) => setPendingPriceInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleSavePendingPrice()
                  }
                }}
                className="input-base pl-11"
              />
            </div>

            <button
              type="button"
              onClick={handleSavePendingPrice}
              className="w-full btn-primary"
            >
              Salvar Valor
            </button>
          </div>
        </div>
      )}

      {/* Modal: Gerenciar Valores Salvos */}
      {showManagePrices && (
        <div
          onClick={() => setShowManagePrices(false)}
          className="fixed inset-0 z-50 bg-primary-900/50 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="card w-full max-w-lg max-h-[82vh] flex flex-col overflow-hidden animate-scale-in"
          >
            <div className="p-5 border-b border-brand-border flex items-center justify-between">
              <div>
                <h3 className="font-editorial text-2xl font-semibold text-primary">
                  Valores Salvos
                </h3>
                <p className="text-xs text-brand-muted">
                  Clique em qualquer valor para editar ou remover do banco.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowManagePrices(false)}
                className="w-8 h-8 rounded-xl hover:bg-brand-cream flex items-center justify-center text-brand-muted"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 overflow-y-auto divide-y divide-brand-border">
              {Object.keys(dbPrices).length === 0 ? (
                <p className="text-center text-sm text-brand-muted py-8">
                  Nenhum valor salvo ainda.
                </p>
              ) : (
                Object.keys(dbPrices)
                  .sort()
                  .map((name) => {
                    const price = Number(dbPrices[name])
                    const isEditing = editingPriceKey === name
                    return (
                      <div key={name} className="py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-primary truncate">{name}</p>
                          {isEditing ? (
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="text-xs font-semibold text-brand-muted">R$</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                autoFocus
                                value={editingPriceVal}
                                onChange={(e) => setEditingPriceVal(e.target.value)}
                                onBlur={() => handleSaveManagedPrice(name)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveManagedPrice(name)
                                  if (e.key === 'Escape') setEditingPriceKey(null)
                                }}
                                className="w-28 px-2 py-1 rounded-lg border border-secondary text-xs text-primary focus:outline-none"
                              />
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingPriceKey(name)
                                setEditingPriceVal(String(price))
                              }}
                              className="inline-flex items-center gap-1 text-xs text-secondary-700 hover:text-primary mt-0.5"
                            >
                              <span>{formatBRL(price)} por sessão</span>
                              <Pencil size={11} />
                            </button>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteManagedPrice(name)}
                          className="px-3 py-1.5 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 text-xs font-medium transition-colors"
                        >
                          Excluir
                        </button>
                      </div>
                    )
                  })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Agrupar Paciente(s) */}
      {mergeSources.length > 0 && (
        <div
          onClick={() => setMergeSources([])}
          className="fixed inset-0 z-50 bg-primary-900/50 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="card w-full max-w-md p-6 space-y-4 animate-scale-in"
          >
            <div>
              <h3 className="font-editorial text-2xl font-semibold text-primary">
                Agrupar Paciente{mergeSources.length > 1 ? 's' : ''}
              </h3>
              <p className="text-sm text-brand-body mt-1">
                Mesclar atendimentos de{' '}
                <strong className="text-primary">
                  {mergeSources.length === 1
                    ? mergeSources[0]
                    : `${mergeSources.length} pacientes (${mergeSources.join(', ')})`}
                </strong>{' '}
                em:
              </p>
            </div>

            <select
              value={mergeTarget}
              onChange={(e) => setMergeTarget(e.target.value)}
              className="input-base"
            >
              {sortedPatientNames
                .filter((n) => !mergeSources.includes(n))
                .map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
            </select>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setMergeSources([])}
                className="flex-1 btn-outline"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmMerge}
                className="flex-1 btn-secondary"
              >
                Confirmar Agrupamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-white text-xs font-semibold shadow-xl animate-slide-up ${
            toast.isError ? 'bg-red-600' : 'bg-primary'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  )
}

