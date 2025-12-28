'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface DataPoint {
  week: string
  words: number
}

interface WordsPerWeekProps {
  data: DataPoint[]
}

export function WordsPerWeek({ data }: WordsPerWeekProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
        <XAxis 
          dataKey="week" 
          stroke="#666"
          tick={{ fontSize: 12 }}
          angle={-45}
          textAnchor="end"
          height={80}
        />
        <YAxis 
          stroke="#666"
          tick={{ fontSize: 12 }}
          label={{ value: 'Total Words', angle: -90, position: 'insideLeft' }}
        />
        <Tooltip 
          contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px' }}
          formatter={(value: number) => [value.toLocaleString(), 'Words']}
        />
        <Line 
          type="monotone" 
          dataKey="words" 
          stroke="#6366f1" 
          strokeWidth={2}
          dot={{ fill: '#6366f1', r: 4 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

