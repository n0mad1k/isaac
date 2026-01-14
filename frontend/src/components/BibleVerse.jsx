import React, { useState, useEffect } from 'react'
import { Book } from 'lucide-react'
import api from '../services/api'

function BibleVerse() {
  const [verse, setVerse] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchVerse = async () => {
      try {
        const response = await api.get('/dashboard/verse-of-the-day')
        setVerse(response.data)
      } catch (err) {
        console.error('Failed to fetch Bible verse:', err)
        // Show a default verse on error
        setVerse({
          text: 'He causes the grass to grow for the cattle, and vegetation for the service of man, that he may bring forth food from the earth.',
          reference: 'Psalm 104:14',
          version: 'NIV'
        })
      } finally {
        setLoading(false)
      }
    }

    fetchVerse()
  }, [])

  if (loading || !verse) {
    return (
      <div className="w-full rounded-lg p-2 md:p-3 lg:p-4"
           style={{
             backgroundColor: '#d4b483',
             border: '1px solid #8a6f3b'
           }}>
        <div className="flex items-center justify-center gap-2">
          <Book className="w-4 h-4 md:w-5 md:h-5" style={{ color: '#6f4b2a' }} />
          <span className="text-xs md:text-sm" style={{ color: '#887f67' }}>Loading verse...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full rounded-lg p-2 md:p-3 lg:p-4"
         style={{
           backgroundColor: '#d4b483',
           border: '1px solid #8a6f3b'
         }}>
      <div className="flex items-start gap-2 md:gap-3">
        <Book className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0 mt-0.5" style={{ color: '#6f4b2a' }} />
        <div className="min-w-0 flex-1">
          <p className="text-xs md:text-sm italic leading-relaxed text-center" style={{ color: '#2d2316' }}>
            "{verse.text}"
          </p>
          <p className="text-xs mt-1 md:mt-2 font-medium text-center" style={{ color: '#6f4b2a' }}>
            — {verse.reference} ({verse.version})
          </p>
        </div>
        <Book className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0 mt-0.5 opacity-0" />
      </div>
    </div>
  )
}

export default BibleVerse
