import { cn } from '@/lib/utils'

interface StepperProps {
  currentStep: number
  totalSteps: number
  labels?: string[]
}

export function Stepper({ currentStep, totalSteps, labels }: StepperProps) {
  return (
    <div className="w-full px-4 py-3 bg-white border-b border-slate-100 shadow-sm sticky top-0 z-10">
      {/* Progress Bar Label */}
      <div className="flex justify-between items-end mb-2">
        <span className="text-xs font-bold text-primary uppercase tracking-wider">
          Passo {currentStep} de {totalSteps}
        </span>
        {labels && labels[currentStep - 1] && (
          <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
            {labels[currentStep - 1]}
          </span>
        )}
      </div>

      {/* Progress Bar Visuals */}
      <div className="flex items-center gap-1.5 w-full">
        {Array.from({ length: totalSteps }).map((_, index) => {
          const stepNumber = index + 1
          const isActive = stepNumber === currentStep
          const isCompleted = stepNumber < currentStep

          return (
            <div
              key={index}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-all duration-300',
                isActive ? 'bg-secondary' : isCompleted ? 'bg-secondary/40' : 'bg-slate-100'
              )}
            />
          )
        })}
      </div>
    </div>
  )
}
