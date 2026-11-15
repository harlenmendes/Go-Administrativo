import { useState } from 'react'
import { X, ZoomIn, FileText, Image as ImageIcon, Download, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export type Anexo = {
  id: string
  tipo: 'imagem' | 'pdf'
  url: string
  nome: string
  descricao?: string
  data?: string
}

// ----------------------------------------------------------------
// Lightbox (visualização em tela cheia)
// ----------------------------------------------------------------
interface LightboxProps {
  anexos: Anexo[]
  indiceInicial: number
  onFechar: () => void
}

function Lightbox({ anexos, indiceInicial, onFechar }: LightboxProps) {
  const [indice, setIndice] = useState(indiceInicial)
  const atual = anexos[indice]
  const total = anexos.length

  const anterior = () => setIndice((i) => (i - 1 + total) % total)
  const proximo = () => setIndice((i) => (i + 1) % total)

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/90 flex flex-col animate-fade-in"
      onClick={onFechar}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-w-0">
          <p className="text-white font-semibold text-sm truncate">{atual.nome}</p>
          {atual.descricao && (
            <p className="text-white/50 text-xs truncate">{atual.descricao}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          <span className="text-white/50 text-xs">{indice + 1}/{total}</span>
          <a
            href={atual.url}
            download={atual.nome}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            aria-label="Baixar arquivo"
          >
            <Download size={15} className="text-white" />
          </a>
          <button
            id="lightbox-fechar"
            onClick={onFechar}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            aria-label="Fechar"
          >
            <X size={15} className="text-white" />
          </button>
        </div>
      </div>

      {/* Conteúdo */}
      <div
        className="flex-1 flex items-center justify-center p-4 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {atual.tipo === 'imagem' ? (
          <img
            src={atual.url}
            alt={atual.nome}
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-scale-in"
          />
        ) : (
          /* PDF — exibido como imagem do laudo mockado */
          <div className="flex flex-col items-center gap-4">
            <img
              src={atual.url}
              alt={atual.nome}
              className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-2xl animate-scale-in"
            />
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20">
              <FileText size={14} className="text-amber-400" />
              <span className="text-white/80 text-xs font-medium">
                Documento — {atual.nome}
              </span>
            </div>
          </div>
        )}

        {/* Navegação lateral */}
        {total > 1 && (
          <>
            <button
              id="lightbox-anterior"
              onClick={anterior}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/25 transition-colors active:scale-95"
            >
              <ChevronLeft size={20} className="text-white" />
            </button>
            <button
              id="lightbox-proximo"
              onClick={proximo}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/25 transition-colors active:scale-95"
            >
              <ChevronRight size={20} className="text-white" />
            </button>
          </>
        )}
      </div>

      {/* Thumbnails na parte inferior */}
      {total > 1 && (
        <div
          className="flex gap-2 px-4 pb-4 pt-2 overflow-x-auto justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          {anexos.map((a, i) => (
            <button
              key={a.id}
              onClick={() => setIndice(i)}
              className={cn(
                'w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all',
                i === indice ? 'border-secondary scale-110' : 'border-white/20 opacity-60 hover:opacity-100'
              )}
            >
              {a.tipo === 'imagem' ? (
                <img src={a.url} alt={a.nome} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-amber-900/50 flex items-center justify-center">
                  <FileText size={18} className="text-amber-300" />
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ----------------------------------------------------------------
// Componente principal — Galeria de Anexos
// ----------------------------------------------------------------
interface AnexosGaleriaProps {
  anexos: Anexo[]
  titulo?: string
  compacto?: boolean
}

export function AnexosGaleria({ anexos, titulo = 'Anexos', compacto = false }: AnexosGaleriaProps) {
  const [lightboxIndice, setLightboxIndice] = useState<number | null>(null)

  if (anexos.length === 0) return null

  const imagens = anexos.filter((a) => a.tipo === 'imagem')
  const pdfs = anexos.filter((a) => a.tipo === 'pdf')

  return (
    <>
      {/* Lightbox */}
      {lightboxIndice !== null && (
        <Lightbox
          anexos={anexos}
          indiceInicial={lightboxIndice}
          onFechar={() => setLightboxIndice(null)}
        />
      )}

      <div className={compacto ? '' : 'card p-4'}>
        {/* Cabeçalho */}
        <div className="flex items-center gap-2 mb-3">
          <ImageIcon size={14} className="text-secondary" strokeWidth={2.5} />
          <span className="text-xs font-bold text-primary uppercase tracking-wide">{titulo}</span>
          <span className="ml-auto text-[10px] font-semibold text-slate-400">
            {imagens.length > 0 && `${imagens.length} foto${imagens.length > 1 ? 's' : ''}`}
            {imagens.length > 0 && pdfs.length > 0 && ' · '}
            {pdfs.length > 0 && `${pdfs.length} doc${pdfs.length > 1 ? 's' : ''}`}
          </span>
        </div>

        {/* Grid de thumbnails */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {anexos.map((anexo, idx) => (
            <button
              key={anexo.id}
              id={`anexo-thumb-${anexo.id}`}
              onClick={() => setLightboxIndice(idx)}
              className="flex-shrink-0 group relative rounded-xl overflow-hidden border border-slate-200 hover:border-secondary transition-all duration-200 active:scale-95"
              style={{ width: compacto ? 64 : 80, height: compacto ? 64 : 80 }}
            >
              {anexo.tipo === 'imagem' ? (
                <>
                  <img
                    src={anexo.url}
                    alt={anexo.nome}
                    className="w-full h-full object-cover"
                  />
                  {/* Overlay hover */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-200 flex items-center justify-center">
                    <ZoomIn
                      size={18}
                      className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg"
                    />
                  </div>
                </>
              ) : (
                /* PDF thumbnail */
                <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-amber-50 border border-amber-200 group-hover:bg-amber-100 transition-colors">
                  <FileText size={compacto ? 20 : 24} className="text-amber-500" strokeWidth={1.5} />
                  <span className="text-[9px] font-bold text-amber-600 px-1 text-center leading-tight line-clamp-2">
                    {anexo.nome}
                  </span>
                </div>
              )}

              {/* Badge de tipo */}
              <div className={cn(
                'absolute top-1 left-1 rounded-md px-1 py-0.5 text-[8px] font-bold',
                anexo.tipo === 'pdf'
                  ? 'bg-amber-500 text-white'
                  : 'bg-black/50 text-white'
              )}>
                {anexo.tipo === 'pdf' ? 'PDF' : 'IMG'}
              </div>
            </button>
          ))}
        </div>

        {/* Legenda do primeiro item se houver descrição */}
        {anexos[0]?.descricao && (
          <p className="text-[10px] text-slate-400 mt-2 italic">{anexos[0].descricao}</p>
        )}
      </div>
    </>
  )
}
