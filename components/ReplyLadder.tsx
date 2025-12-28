'use client'

interface ReplyLadderData {
  doubleTextsYou: number
  doubleTextsThem: number
  endersYou: number
  endersThem: number
}

interface ReplyLadderProps {
  data: ReplyLadderData
}

export function ReplyLadder({ data }: ReplyLadderProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Double Texts</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <span className="font-medium text-gray-700">You</span>
            <span className="text-2xl font-bold text-green-600">{data.doubleTextsYou}</span>
          </div>
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <span className="font-medium text-gray-700">Them</span>
            <span className="text-2xl font-bold text-red-600">{data.doubleTextsThem}</span>
          </div>
        </div>
      </div>
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Conversation Enders</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <span className="font-medium text-gray-700">You</span>
            <span className="text-2xl font-bold text-green-600">{data.endersYou}</span>
          </div>
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <span className="font-medium text-gray-700">Them</span>
            <span className="text-2xl font-bold text-red-600">{data.endersThem}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

