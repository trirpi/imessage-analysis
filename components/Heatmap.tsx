'use client'

import { useMemo, useState } from 'react'

interface HeatmapData {
  day: string
  hour: number
  value: number
}

interface HeatmapProps {
  data: HeatmapData[]
}

export function Heatmap({ data }: HeatmapProps) {
  const [tooltip, setTooltip] = useState<{ day: string; hour: number; value: number; x: number; y: number } | null>(null)

  const maxValue = useMemo(() => {
    return Math.max(...data.map(d => d.value), 1)
  }, [data])

  const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  const hours = Array.from({ length: 24 }, (_, i) => i)

  const getColor = (value: number) => {
    if (value === 0) return 'bg-gray-100'
    const intensity = value / maxValue
    if (intensity < 0.1) return 'bg-yellow-100'
    if (intensity < 0.2) return 'bg-yellow-200'
    if (intensity < 0.4) return 'bg-yellow-300'
    if (intensity < 0.6) return 'bg-yellow-400'
    if (intensity < 0.8) return 'bg-yellow-500'
    return 'bg-amber-600'
  }

  const getValue = (day: string, hour: number) => {
    const dataPoint = data.find(d => d.day === day && d.hour === hour)
    return dataPoint?.value || 0
  }

  const formatNumber = (value: number): string => {
    if (value <= 999) {
      return value.toString()
    } else if (value < 1000000) {
      // Format as thousands (1k, 10k, 100k, etc.)
      const thousands = value / 1000
      if (thousands < 10) {
        return `${thousands.toFixed(1)}k`.replace('.0', '')
      } else if (thousands < 100) {
        return `${Math.round(thousands)}k`
      } else {
        return `${Math.round(thousands)}k`
      }
    } else {
      // Format as millions (1m, 10m, etc.)
      const millions = value / 1000000
      if (millions < 10) {
        return `${millions.toFixed(1)}m`.replace('.0', '')
      } else {
        return `${Math.round(millions)}m`
      }
    }
  }

  const handleCellHover = (day: string, hour: number, event: React.MouseEvent<HTMLDivElement>) => {
    const value = getValue(day, hour)
    const rect = event.currentTarget.getBoundingClientRect()
    setTooltip({
      day,
      hour,
      value,
      x: rect.left + rect.width / 2,
      y: rect.top - 10
    })
  }

  const handleCellLeave = () => {
    setTooltip(null)
  }

  return (
    <div className="w-full relative">
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          <div className="grid grid-cols-[120px_repeat(24,1fr)] gap-1">
            {/* Header row */}
            <div className="col-span-1"></div>
            {hours.map(hour => (
              <div key={hour} className="text-xs text-center text-gray-600 font-medium py-2">
                {hour}
              </div>
            ))}

            {/* Data rows */}
            {dayOrder.map(day => (
              <div key={day} className="contents">
                <div className="text-sm font-medium text-gray-700 py-2 pr-4 text-right">
                  {day.substring(0, 3)}
                </div>
                {hours.map(hour => {
                  const value = getValue(day, hour)
                  return (
                    <div
                      key={`${day}-${hour}`}
                      className={`${getColor(value)} border border-gray-200 rounded cursor-pointer transition-all hover:ring-2 hover:ring-indigo-400 hover:z-10 relative`}
                      style={{ minWidth: '24px', minHeight: '32px' }}
                      onMouseEnter={(e) => handleCellHover(day, hour, e)}
                      onMouseLeave={handleCellLeave}
                      title={`${day} ${hour}:00 - ${value} message${value !== 1 ? 's' : ''}`}
                    >
                      {value > 0 && (
                        <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-gray-700">
                          {formatNumber(value)}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed bg-white p-3 border border-gray-300 rounded-lg shadow-lg z-50 pointer-events-none"
          style={{
            left: `${tooltip.x}px`,
            top: `${tooltip.y}px`,
            transform: 'translate(-50%, -100%)'
          }}
        >
          <p className="font-semibold text-gray-900">{tooltip.day}</p>
          <p className="text-sm text-gray-600">{tooltip.hour}:00 - {tooltip.hour + 1}:00</p>
          <p className="text-sm font-medium text-indigo-600">{tooltip.value} message{tooltip.value !== 1 ? 's' : ''}</p>
        </div>
      )}

      {/* Legend */}
      <div className="mt-6 flex items-center justify-center gap-4">
        <span className="text-sm text-gray-600">Less</span>
        <div className="flex gap-1">
          <div className="w-5 h-5 bg-gray-100 border border-gray-200 rounded"></div>
          <div className="w-5 h-5 bg-yellow-100 border border-gray-200 rounded"></div>
          <div className="w-5 h-5 bg-yellow-300 border border-gray-200 rounded"></div>
          <div className="w-5 h-5 bg-yellow-400 border border-gray-200 rounded"></div>
          <div className="w-5 h-5 bg-yellow-500 border border-gray-200 rounded"></div>
          <div className="w-5 h-5 bg-amber-600 border border-gray-200 rounded"></div>
        </div>
        <span className="text-sm text-gray-600">More</span>
      </div>
    </div>
  )
}

