

interface ChipGroupProps {
  options: string[]
  selected: string[]
  onChange: (selected: string[]) => void
  multiSelect?: boolean
}

export function ChipGroup({ options, selected, onChange, multiSelect = true }: ChipGroupProps) {
  const toggleOption = (option: string) => {
    if (multiSelect) {
      if (selected.includes(option)) {
        onChange(selected.filter((item) => item !== option))
      } else {
        onChange([...selected, option])
      }
    } else {
      onChange([option])
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const isSelected = selected.includes(option)
        return (
          <button
            key={option}
            type="button"
            onClick={() => toggleOption(option)}
            className={`
              px-3 py-2 rounded-xl text-xs font-bold transition-all duration-200
              ${isSelected 
                ? 'bg-secondary text-white shadow-sm ring-2 ring-secondary/30 scale-95' 
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}
            `}
          >
            {option}
          </button>
        )
      })}
    </div>
  )
}
