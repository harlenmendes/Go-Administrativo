import { useState, useRef } from 'react'
import { UploadCloud, FileText, X, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface UploadedFile {
  id: string
  name: string
  type: 'image' | 'pdf'
  url: string
}

interface FormUploadFakeProps {
  label?: string
  files: UploadedFile[]
  onChange: (files: UploadedFile[]) => void
}

export function FormUploadFake({ label = "Toque para anexar", files, onChange }: FormUploadFakeProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = (file: File) => {
    setIsUploading(true)
    const reader = new FileReader()
    reader.onload = (e) => {
      const url = e.target?.result as string
      const isPdf = file.type === 'application/pdf'
      const newFile: UploadedFile = {
        id: Math.random().toString(36).substring(7),
        name: file.name,
        type: isPdf ? 'pdf' : 'image',
        url
      }
      onChange([...files, newFile])
      setIsUploading(false)
    }
    reader.readAsDataURL(file)
  }

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0])
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0])
    }
  }

  const handleRemove = (id: string) => {
    onChange(files.filter(f => f.id !== id))
  }

  return (
    <div className="space-y-4 w-full">
      <input 
        type="file" 
        className="hidden" 
        ref={fileInputRef} 
        onChange={onFileChange} 
        accept="image/*,application/pdf"
      />
      {/* Upload Zone */}
      <div
        className={cn(
          "w-full rounded-2xl border-2 border-dashed p-6 transition-all duration-200 flex flex-col items-center justify-center text-center gap-3",
          isDragging ? "border-secondary bg-secondary-50" : "border-slate-200 bg-slate-50",
          isUploading ? "opacity-50 pointer-events-none" : "hover:border-secondary-300 hover:bg-slate-100 cursor-pointer"
        )}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
      >
        <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center text-primary mb-1">
          <UploadCloud size={24} strokeWidth={2} />
        </div>
        <div>
          <p className="text-sm font-bold text-primary">{label}</p>
          <p className="text-xs text-slate-400 mt-1">Imagens, RX, Ressonância ou Laudos em PDF</p>
        </div>
      </div>

      {/* Uploading State */}
      {isUploading && (
        <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-white shadow-sm animate-pulse">
          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold text-slate-600">Enviando arquivo...</p>
            <div className="h-1.5 w-full bg-slate-100 rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-secondary w-1/2 animate-[pulse_1s_ease-in-out_infinite]" />
            </div>
          </div>
        </div>
      )}

      {/* Uploaded Files List */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map(file => (
            <div key={file.id} className="flex items-center gap-3 p-2 pr-3 rounded-xl border border-slate-100 bg-white shadow-sm animate-fade-in group">
              {/* Thumbnail */}
              <div className="w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden border border-slate-100 relative">
                {file.type === 'image' ? (
                  <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-amber-50 flex items-center justify-center">
                    <FileText size={20} className="text-amber-500" />
                  </div>
                )}
              </div>
              
              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-700 truncate">{file.name}</p>
                <div className="flex items-center gap-1 text-[10px] text-secondary mt-0.5 font-semibold">
                  <CheckCircle2 size={12} /> Anexado
                </div>
              </div>

              {/* Remove Action */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleRemove(file.id); }}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-danger hover:bg-red-50 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
