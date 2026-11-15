import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '@/components/layout/TopBar'
import { CheckCircle2, UserRound, MapPin, Briefcase, Mail, Phone, Calendar as CalendarIcon, FileText, Share2 } from 'lucide-react'
import { OrigemEncaminhamento } from '@/types'
import { usePacientesStore } from '@/stores/usePacientesStore'
import { formatarData, formatCelular } from '@/lib/utils'

// Helpers de validação
const validarCPF = (cpf: string) => {
  const strCPF = cpf.replace(/[^\d]+/g, '')
  if (strCPF.length !== 11 || /^(\d)\1{10}$/.test(strCPF)) return false
  let soma = 0, resto
  for (let i = 1; i <= 9; i++) soma += parseInt(strCPF.substring(i - 1, i)) * (11 - i)
  resto = (soma * 10) % 11
  if (resto === 10 || resto === 11) resto = 0
  if (resto !== parseInt(strCPF.substring(9, 10))) return false
  soma = 0
  for (let i = 1; i <= 10; i++) soma += parseInt(strCPF.substring(i - 1, i)) * (12 - i)
  resto = (soma * 10) % 11
  if (resto === 10 || resto === 11) resto = 0
  return resto === parseInt(strCPF.substring(10, 11))
}

const validarEmail = (email: string) => {
  if (!email) return true // opcional
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

const validarNascimento = (data: string) => {
  if (!data || data.length < 10) return false
  const parts = data.split('/')
  if (parts.length !== 3) return false
  const year = parseInt(parts[2])
  const currentYear = new Date().getFullYear()
  return year > 1920 && year <= currentYear
}

const formatDataMask = (val: string) => {
  let cleaned = val.replace(/\D/g, '')
  if (cleaned.length > 8) cleaned = cleaned.substring(0, 8)
  if (cleaned.length > 4) {
    cleaned = cleaned.substring(0, 2) + '/' + cleaned.substring(2, 4) + '/' + cleaned.substring(4)
  } else if (cleaned.length > 2) {
    cleaned = cleaned.substring(0, 2) + '/' + cleaned.substring(2)
  }
  return cleaned
}

const validarNome = (nome: string) => {
  return nome.trim().split(' ').length >= 2
}

const validarCelular = (cel: string) => {
  return cel.replace(/\D/g, '').length >= 10
}

import { useSearchParams } from 'react-router-dom'
import { getPacienteById, updatePaciente } from '@/lib/api'

export function NewPatient() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const editId = searchParams.get('edit')
  
  const [isSaving, setIsSaving] = useState(false)

  // Estados dos campos
  const [nome, setNome] = useState('')
  const [dataNascimento, setDataNascimento] = useState('')
  const [cpf, setCpf] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [endereco, setEndereco] = useState('')
  const [profissao, setProfissao] = useState('')
  const [origem, setOrigem] = useState<OrigemEncaminhamento>('Particular')
  const [dataCriacao, setDataCriacao] = useState(formatarData(new Date().toISOString()))

  // Indicação
  const [indicacaoNome, setIndicacaoNome] = useState('')
  const [indicacaoTelefone, setIndicacaoTelefone] = useState('')
  const [indicacaoEmpresa, setIndicacaoEmpresa] = useState('')
  const [indicacaoEmail, setIndicacaoEmail] = useState('')

  // Erros
  const [errors, setErrors] = useState<Record<string, string>>({})

  const { addPaciente } = usePacientesStore()

  useEffect(() => {
    if (editId) {
      getPacienteById(editId).then(pac => {
        if (pac) {
          setNome(pac.nome)
          if (pac.data_nascimento) {
            setDataNascimento(pac.data_nascimento.split('-').reverse().join('/'))
          }
          setCpf(pac.cpf)
          setEmail(pac.email || '')
          setTelefone(pac.telefone)
          setEndereco(pac.endereco || '')
          setProfissao(pac.profissao || '')
          setOrigem(pac.origem_encaminhamento || 'Particular')
          setDataCriacao(pac.data_criacao ? formatarData(pac.data_criacao) : formatarData(new Date().toISOString()))
          if (pac.indicacao_detalhes) {
            setIndicacaoNome(pac.indicacao_detalhes.nome || '')
            setIndicacaoTelefone(pac.indicacao_detalhes.telefone || '')
            setIndicacaoEmpresa(pac.indicacao_detalhes.empresa || '')
            setIndicacaoEmail(pac.indicacao_detalhes.email || '')
          }
        }
      }).catch(console.error)
    }
  }, [editId])

  // Máscaras e validação
  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '')
    if (val.length <= 11) {
      val = val.replace(/(\d{3})(\d)/, '$1.$2')
      val = val.replace(/(\d{3})(\d)/, '$1.$2')
      val = val.replace(/(\d{3})(\d{1,2})$/, '$1-$2')
      setCpf(val)
      if (val.length === 14 && !validarCPF(val)) {
        setErrors(prev => ({ ...prev, cpf: 'CPF inválido' }))
      } else {
        const newErrors = { ...errors }; delete newErrors.cpf; setErrors(newErrors)
      }
    }
  }



  const handleTelefoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCelular(e.target.value)
    setTelefone(formatted)
    if (formatted.length > 0 && formatted.length < 15) {
      setErrors(prev => ({ ...prev, telefone: 'Celular inválido. Inclua o DDD.' }))
    } else {
      const newErrors = { ...errors }; delete newErrors.telefone; setErrors(newErrors)
    }
  }

  // Handlers de Blur (Ao sair do campo)
  const handleBlur = (field: string) => {
    const newErrors = { ...errors }

    if (field === 'nome' && nome && !validarNome(nome)) {
      newErrors.nome = 'Por favor, informe o nome completo (pelo menos nome e sobrenome).'
    } else if (field === 'nome') delete newErrors.nome

    if (field === 'cpf' && cpf && !validarCPF(cpf)) {
      newErrors.cpf = 'CPF inválido.'
    } else if (field === 'cpf') delete newErrors.cpf

    if (field === 'dataNascimento' && dataNascimento && !validarNascimento(dataNascimento)) {
      newErrors.dataNascimento = 'Ano deve ser maior que 1920 e menor ou igual ao ano atual.'
    } else if (field === 'dataNascimento') delete newErrors.dataNascimento

    if (field === 'email' && email && !validarEmail(email)) {
      newErrors.email = 'E-mail em formato inválido.'
    } else if (field === 'email') delete newErrors.email

    if (field === 'telefone' && telefone && !validarCelular(telefone)) {
      newErrors.telefone = 'Celular inválido. Inclua o DDD.'
    } else if (field === 'telefone') delete newErrors.telefone

    setErrors(newErrors)
  }

  const isFormValid = () => {
    return (
      nome && validarNome(nome) &&
      cpf && validarCPF(cpf) &&
      dataNascimento && validarNascimento(dataNascimento) &&
      telefone && validarCelular(telefone) &&
      (!email || validarEmail(email)) &&
      Object.keys(errors).length === 0
    )
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isFormValid()) return

    setIsSaving(true)
    try {
      const payload = {
        nome,
        data_nascimento: dataNascimento.split('/').reverse().join('-'),
        cpf,
        email: email ? email.toLowerCase() : '',
        telefone,
        endereco: endereco,
        profissao: profissao,
        origem_encaminhamento: origem,
        indicacao_nome: indicacaoNome,
        indicacao_telefone: indicacaoTelefone,
        indicacao_empresa: indicacaoEmpresa,
        indicacao_email: indicacaoEmail,
        data_criacao: dataCriacao
      }

      if (editId) {
        await updatePaciente(editId, payload)
      } else {
        await addPaciente(payload as any)
      }
      setIsSaving(false)
      navigate('/pacientes')
    } catch (error) {
      console.error(error)
      alert('Erro ao salvar paciente')
      setIsSaving(false)
    }
  }

  return (
    <div className="w-full flex flex-col min-h-[100dvh] bg-slate-50 max-w-md md:max-w-2xl lg:max-w-3xl mx-auto relative shadow-2xl xl:shadow-none xl:border-x xl:border-slate-100">
      <TopBar title={editId ? "Editar Paciente" : "Novo Paciente"} showBack />

      <main className="flex-1 p-4 pb-24">
        <form id="form-paciente" onSubmit={handleSave} className="space-y-6 animate-fade-in">
          {/* Dados Pessoais */}
          <div className="space-y-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <h2 className="text-sm font-bold text-primary flex items-center gap-2 mb-4 border-b border-slate-100 pb-2">
              <UserRound size={16} />
              Dados Pessoais
            </h2>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700">Nome Completo *</label>
              <input
                type="text"
                required
                className={`input-base ${errors.nome ? 'border-danger focus:ring-danger/20' : ''}`}
                placeholder="Ex: Ana Maria Silva"
                value={nome}
                onChange={e => setNome(e.target.value)}
                onBlur={() => handleBlur('nome')}
              />
              {errors.nome && <p className="text-[10px] font-semibold text-danger">{errors.nome}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <FileText size={12} className="text-slate-400" />
                  CPF *
                </label>
                <input
                  type="text"
                  required
                  className={`input-base ${errors.cpf ? 'border-danger focus:ring-danger/20' : ''}`}
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={handleCpfChange}
                  onBlur={() => handleBlur('cpf')}
                />
                {errors.cpf && <p className="text-[10px] font-semibold text-danger">{errors.cpf}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <CalendarIcon size={12} className="text-slate-400" />
                  Nascimento *
                </label>
                <input
                  type="text"
                  required
                  className={`input-base ${errors.dataNascimento ? 'border-danger focus:ring-danger/20' : ''}`}
                  placeholder="DD/MM/AAAA"
                  value={dataNascimento}
                  onChange={e => setDataNascimento(formatDataMask(e.target.value))}
                  onBlur={() => handleBlur('dataNascimento')}
                />
                {errors.dataNascimento && <p className="text-[10px] font-semibold text-danger">{errors.dataNascimento}</p>}
              </div>
            </div>
          </div>

          {/* Contato */}
          <div className="space-y-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <h2 className="text-sm font-bold text-primary flex items-center gap-2 mb-4 border-b border-slate-100 pb-2">
              <Phone size={16} />
              Contato
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Phone size={12} className="text-slate-400" />
                  Celular / WhatsApp *
                </label>
                <input
                  type="tel"
                  required
                  className={`input-base ${errors.telefone ? 'border-danger focus:ring-danger/20' : ''}`}
                  placeholder="(11) 99999-9999"
                  value={telefone}
                  onChange={handleTelefoneChange}
                  onBlur={() => handleBlur('telefone')}
                />
                {errors.telefone && <p className="text-[10px] font-semibold text-danger">{errors.telefone}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Mail size={12} className="text-slate-400" />
                  E-mail
                </label>
                <input
                  type="email"
                  className={`input-base ${errors.email ? 'border-danger focus:ring-danger/20' : ''}`}
                  placeholder="paciente@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onBlur={() => handleBlur('email')}
                />
                {errors.email && <p className="text-[10px] font-semibold text-danger">{errors.email}</p>}
              </div>
            </div>
          </div>

          {/* Endereço e Administrativo */}
          <div className="space-y-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <h2 className="text-sm font-bold text-primary flex items-center gap-2 mb-4 border-b border-slate-100 pb-2">
              <MapPin size={16} />
              Endereço e Administrativo
            </h2>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700">Endereço Completo</label>
              <textarea
                className="input-base min-h-[60px] resize-none"
                placeholder="Rua, número, complemento, bairro, cidade - CEP"
                value={endereco}
                onChange={e => setEndereco(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Briefcase size={12} className="text-slate-400" />
                  Profissão
                </label>
                <input
                  type="text"
                  className="input-base"
                  placeholder="Ex: Advogado"
                  value={profissao}
                  onChange={e => setProfissao(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <CalendarIcon size={12} className="text-slate-400" />
                  Paciente Desde
                </label>
                <input
                  type="text"
                  className="input-base"
                  placeholder="DD/MM/AAAA"
                  maxLength={10}
                  value={dataCriacao}
                  onChange={e => setDataCriacao(formatDataMask(e.target.value))}
                />
              </div>
            </div>
          </div>

          {/* Origem / Indicação */}
          <div className="space-y-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <h2 className="text-sm font-bold text-primary flex items-center gap-2 mb-4 border-b border-slate-100 pb-2">
              <Share2 size={16} />
              Origem do Paciente
            </h2>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700">Como nos conheceu?</label>
              <select
                className="input-base"
                value={origem}
                onChange={e => setOrigem(e.target.value as OrigemEncaminhamento)}
              >
                <option value="Particular">Redes Sociais / Particular</option>
                <option value="Indicação">Indicação de outro paciente / Amigo</option>
                <option value="Médico">Encaminhamento Médico</option>
              </select>
            </div>

            {/* Campos condicionais de indicação */}
            {(origem === 'Indicação' || origem === 'Médico') && (
              <div className="mt-4 p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-3 animate-fade-in">
                <p className="text-[11px] font-bold text-primary uppercase tracking-wider mb-2">
                  Dados de quem indicou
                </p>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-600">Nome (Pessoa ou Clínica)</label>
                  <input
                    type="text"
                    className="input-base text-sm py-2"
                    placeholder="Ex: Dr. José ou Clínica XYZ"
                    value={indicacaoNome}
                    onChange={e => setIndicacaoNome(e.target.value)}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-600">Telefone</label>
                    <input
                      type="tel"
                      className="input-base text-sm py-2"
                      placeholder="(11) 9999-9999"
                      value={indicacaoTelefone}
                      onChange={e => setIndicacaoTelefone(formatCelular(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-600">E-mail</label>
                    <input
                      type="email"
                      className="input-base text-sm py-2"
                      placeholder="email@clinica.com"
                      value={indicacaoEmail}
                      onChange={e => setIndicacaoEmail(e.target.value)}
                    />
                  </div>
                </div>
                
                {origem === 'Médico' && (
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-600">Especialidade / Empresa</label>
                    <input
                      type="text"
                      className="input-base text-sm py-2"
                      placeholder="Ex: Ortopedista - Clínica Albert Einstein"
                      value={indicacaoEmpresa}
                      onChange={e => setIndicacaoEmpresa(e.target.value)}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </form>
      </main>

      {/* Footer Fixo (Movido para fora do form para evitar bug de fixed position com CSS transform) */}
      <div className="w-full fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-100 flex items-center shadow-bottom-nav z-10 max-w-md md:max-w-2xl lg:max-w-3xl mx-auto">
        <button
          type="submit"
          form="form-paciente"
          disabled={isSaving || !isFormValid()}
          className="w-full py-3.5 px-4 rounded-xl bg-secondary text-white font-bold text-sm hover:bg-secondary-600 transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isSaving ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <CheckCircle2 size={18} />
              Cadastrar Paciente
            </>
          )}
        </button>
      </div>
    </div>
  )
}
