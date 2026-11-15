import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { Search, ChevronRight, Check } from 'lucide-react'

interface AutocompleteInputProps {
  id?: string
  value: string
  onChange: (value: string) => void
  suggestions: string[]
  placeholder?: string
  required?: boolean
  className?: string
}

export function AutocompleteInput({
  id,
  value,
  onChange,
  suggestions,
  placeholder = 'Digite para buscar ou criar...',
  required = false,
  className = '',
}: AutocompleteInputProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  // Filtra as sugestões ignorando acentos e case
  const normalizeText = (text: string) =>
    text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()

  const queryNormal = normalizeText(value)
  const filteredSuggestions = suggestions.filter((item) =>
    normalizeText(item).includes(queryNormal)
  )

  // Fecha o dropdown se clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Reseta a seleção destacada quando as sugestões mudam
  useEffect(() => {
    setHighlightedIndex(filteredSuggestions.length > 0 ? 0 : -1)
  }, [value, suggestions.length])

  // Rola o item destacado para a visão na lista
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const activeItem = listRef.current.children[highlightedIndex] as HTMLElement
      if (activeItem) {
        activeItem.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [highlightedIndex])

  const handleSelect = (item: string) => {
    onChange(item)
    setIsOpen(false)
    setHighlightedIndex(-1)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        setIsOpen(true)
      }
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex((prev) =>
        filteredSuggestions.length === 0
          ? -1
          : (prev + 1) % filteredSuggestions.length
      )
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex((prev) =>
        filteredSuggestions.length === 0
          ? -1
          : (prev - 1 + filteredSuggestions.length) % filteredSuggestions.length
      )
    } else if (e.key === 'Enter') {
      if (highlightedIndex >= 0 && highlightedIndex < filteredSuggestions.length) {
        e.preventDefault()
        handleSelect(filteredSuggestions[highlightedIndex])
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div className="relative">
        <input
          id={id}
          type="text"
          required={required}
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            if (!isOpen) setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`input-base pr-8 ${className}`}
          autoComplete="off"
        />
        <Search
          size={14}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
        />
      </div>

      {isOpen && filteredSuggestions.length > 0 && (
        <ul
          ref={listRef}
          className="absolute left-0 right-0 top-full mt-1 max-h-52 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl z-30 py-1 divide-y divide-slate-50 animate-fade-in"
        >
          {filteredSuggestions.map((item, index) => {
            const isSelected = item.toLowerCase() === value.toLowerCase()
            const isHighlighted = index === highlightedIndex

            return (
              <li
                key={item}
                onClick={() => handleSelect(item)}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={`px-3 py-2 text-xs font-semibold cursor-pointer flex items-center justify-between transition-colors ${
                  isHighlighted
                    ? 'bg-primary-50 text-primary-700 font-bold'
                    : isSelected
                    ? 'bg-slate-50 text-primary'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="truncate">{item}</span>
                {isSelected ? (
                  <Check size={14} className="text-secondary flex-shrink-0 ml-2" />
                ) : (
                  <ChevronRight size={12} className="text-slate-300 flex-shrink-0 ml-2" />
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
