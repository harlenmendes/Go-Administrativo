

interface SliderDorProps {
  label: string
  value: number
  onChange: (val: number) => void
}

export function SliderDor({ label, value, onChange }: SliderDorProps) {
  // Cores dinâmicas baseadas no valor
  const getColor = (val: number) => {
    if (val <= 3) return 'text-secondary bg-secondary' // Verde
    if (val <= 6) return 'text-amber-500 bg-amber-500' // Amarelo
    return 'text-danger bg-danger' // Vermelho
  }

  // Emoji dinâmico
  const getEmoji = (val: number) => {
    if (val === 0) return '😄'
    if (val <= 3) return '🙂'
    if (val <= 6) return '😐'
    if (val <= 8) return '😟'
    return '😫'
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-700">{label}</label>
        <div className="flex items-center gap-2">
          <span className="text-xl">{getEmoji(value)}</span>
          <span className={`text-lg font-black ${getColor(value).split(' ')[0]}`}>
            {value}
          </span>
          <span className="text-xs text-slate-400 font-semibold">/ 10</span>
        </div>
      </div>

      <div className="relative pt-2 pb-6">
        <input
          type="range"
          min="0"
          max="10"
          step="1"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          style={{
            background: `linear-gradient(to right, 
              #4CAF50 0%, 
              #f59e0b 50%, 
              #ef4444 100%)`
          }}
        />
        
        {/* Marcadores visuais */}
        <div className="absolute top-8 left-0 right-0 flex justify-between px-1 pointer-events-none">
          <span className="text-[10px] font-bold text-slate-400">0</span>
          <span className="text-[10px] font-bold text-slate-400">5</span>
          <span className="text-[10px] font-bold text-slate-400">10</span>
        </div>
      </div>
    </div>
  )
}
