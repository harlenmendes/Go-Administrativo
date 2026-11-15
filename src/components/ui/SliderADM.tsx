

interface SliderADMProps {
  label: string
  value: number
  onChange: (val: number) => void
}

export function SliderADM({ label, value, onChange }: SliderADMProps) {
  // Cores dinâmicas baseadas no valor: ADM alta (100) é Bom (Verde), baixa (0) é Ruim (Vermelho)
  const getColor = (val: number) => {
    if (val >= 80) return 'text-secondary bg-secondary' // Verde
    if (val >= 40) return 'text-amber-500 bg-amber-500' // Amarelo
    return 'text-danger bg-danger' // Vermelho
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-700">{label}</label>
        <div className="flex items-center gap-2">
          <span className={`text-lg font-black ${getColor(value).split(' ')[0]}`}>
            {value}%
          </span>
        </div>
      </div>

      <div className="relative pt-2 pb-6">
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          style={{
            background: `linear-gradient(to right, 
              #ef4444 0%, 
              #f59e0b 50%, 
              #4CAF50 100%)`
          }}
        />
        
        {/* Marcadores visuais */}
        <div className="absolute top-8 left-0 right-0 flex justify-between px-1 pointer-events-none">
          <span className="text-[10px] font-bold text-slate-400">0%</span>
          <span className="text-[10px] font-bold text-slate-400">50%</span>
          <span className="text-[10px] font-bold text-slate-400">100%</span>
        </div>
      </div>
    </div>
  )
}
