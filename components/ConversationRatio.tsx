'use client'

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface DataPoint {
  week: string
  you: number
  them: number
}

interface ConversationRatioProps {
  data: DataPoint[]
}

export function ConversationRatio({ data }: ConversationRatioProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="colorYou" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
            <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
          </linearGradient>
          <linearGradient id="colorThem" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
            <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1}/>
          </linearGradient>
        </defs>
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
          domain={[0, 1]}
          label={{ value: 'Word Ratio', angle: -90, position: 'insideLeft' }}
        />
        <Tooltip 
          contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px' }}
          formatter={(value: number) => [`${(value * 100).toFixed(1)}%`, '']}
        />
        <Area 
          type="monotone" 
          dataKey="you" 
          stackId="1"
          stroke="#10b981" 
          fill="url(#colorYou)"
          name="You"
        />
        <Area 
          type="monotone" 
          dataKey="them" 
          stackId="1"
          stroke="#ef4444" 
          fill="url(#colorThem)"
          name="Them"
        />
        <Legend />
      </AreaChart>
    </ResponsiveContainer>
  )
}

