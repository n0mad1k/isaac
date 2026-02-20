import React, { useState, useEffect } from 'react'
import { Book, ChevronDown, ChevronUp, X } from 'lucide-react'
import api from '../services/api'

function BibleVerse() {
  const [verse, setVerse] = useState(null)
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState(false)

  // Check if verse was acknowledged today
  useEffect(() => {
    const today = new Date().toDateString()
    const storedDate = localStorage.getItem('bibleVerseAckDate')
    if (storedDate === today) {
      setCollapsed(true)
    }
  }, [])

  const handleAcknowledge = () => {
    const today = new Date().toDateString()
    localStorage.setItem('bibleVerseAckDate', today)
    setCollapsed(true)
  }

  const handleExpand = () => {
    setCollapsed(false)
  }

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
             backgroundColor: 'var(--color-bg-surface)',
             border: '1px solid var(--color-border-default)'
           }}>
        <div className="flex items-center justify-center gap-2">
          <Book className="w-4 h-4 md:w-5 md:h-5" style={{ color: 'var(--color-gold-600)' }} />
          <span className="text-xs md:text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading verse...</span>
        </div>
      </div>
    )
  }

  // Collapsed state - show minimal bar that can be expanded
  if (collapsed) {
    return (
      <button
        onClick={handleExpand}
        className="w-full rounded-lg p-2 flex items-center justify-center gap-2 transition-colors"
        style={{
          backgroundColor: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border-default)'
        }}
        onMouseOver={e => e.currentTarget.style.backgroundColor = 'var(--color-bg-surface-hover)'}
        onMouseOut={e => e.currentTarget.style.backgroundColor = 'var(--color-bg-surface)'}
      >
        <Book className="w-4 h-4" style={{ color: 'var(--color-gold-600)' }} />
        <span className="text-xs font-medium" style={{ color: 'var(--color-gold-700)' }}>
          Verse of the Day
        </span>
        <ChevronDown className="w-4 h-4" style={{ color: 'var(--color-gold-600)' }} />
      </button>
    )
  }

  return (
    <div className="w-full rounded-lg p-2 md:p-3 lg:p-4 relative"
         style={{
           backgroundColor: 'var(--color-bg-surface)',
           border: '1px solid var(--color-border-default)'
         }}>
      {/* Collapse button */}
      <button
        onClick={handleAcknowledge}
        className="absolute top-2 right-2 p-1 rounded-full transition-colors"
        style={{ color: 'var(--color-text-muted)' }}
        onMouseOver={e => e.currentTarget.style.color = 'var(--color-gold-700)'}
        onMouseOut={e => e.currentTarget.style.color = 'var(--color-text-muted)'}
        title="Collapse for today"
      >
        <ChevronUp className="w-4 h-4" />
      </button>

      <div className="flex items-start gap-2 md:gap-3 pr-6">
        <Book className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--color-gold-600)' }} />
        <div className="min-w-0 flex-1">
          <p className="text-xs md:text-sm italic leading-relaxed text-center" style={{ color: 'var(--color-text-primary)' }}>
            "{verse.text}"
          </p>
          <p className="text-xs mt-1 md:mt-2 font-medium text-center" style={{ color: 'var(--color-gold-700)' }}>
            — {verse.reference} ({verse.version})
          </p>
        </div>
        <Book className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0 mt-0.5 opacity-0" />
      </div>
    </div>
  )
}

export default BibleVerse
