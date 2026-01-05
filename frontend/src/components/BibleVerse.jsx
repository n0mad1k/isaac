import React, { useState, useEffect } from 'react'
import { Book } from 'lucide-react'

function BibleVerse() {
  const [verse, setVerse] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchVerse = async () => {
      try {
        // Fetch bible.com verse of the day page
        const response = await fetch('https://www.bible.com/verse-of-the-day')
        const html = await response.text()

        // Extract verse from og:description meta tag
        const match = html.match(/og:description" content="([^"]+)"/)
        if (match && match[1]) {
          // Format: "Romans 12:2 Do not conform..."
          const content = match[1]
          const refMatch = content.match(/^([\d\s]*[A-Za-z]+\s+\d+:\d+(?:-\d+)?)\s+(.+)$/)

          if (refMatch) {
            setVerse({
              reference: refMatch[1],
              text: refMatch[2],
              version: 'NIV'
            })
          } else {
            throw new Error('Could not parse verse')
          }
        } else {
          throw new Error('Could not find verse in page')
        }
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
      <div className="w-full bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
        <div className="flex items-center justify-center gap-2">
          <Book className="w-5 h-5 text-amber-400" />
          <span className="text-gray-500 text-sm">Loading verse...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
      <div className="flex items-start gap-3">
        <Book className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-gray-300 text-sm italic leading-relaxed text-center">
            "{verse.text}"
          </p>
          <p className="text-amber-400 text-xs mt-2 font-medium text-center">
            — {verse.reference} ({verse.version})
          </p>
        </div>
        <Book className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5 opacity-0" />
      </div>
    </div>
  )
}

export default BibleVerse
