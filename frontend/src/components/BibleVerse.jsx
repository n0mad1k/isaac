import React, { useState, useEffect } from 'react'
import { Book } from 'lucide-react'
import { getSettings } from '../services/api'

// Verse references for farming/homestead themed daily verses
const VERSE_REFERENCES = [
  "Deuteronomy 28:12",
  "Proverbs 12:11",
  "Ecclesiastes 3:1-2",
  "Psalm 104:14",
  "1 Corinthians 3:6",
  "Proverbs 21:5",
  "Proverbs 12:10",
  "Proverbs 27:23",
  "Proverbs 10:5",
  "Psalm 24:1",
  "Genesis 1:28",
  "Psalm 127:1",
  "Genesis 2:15",
  "Proverbs 16:3",
  "Colossians 3:23",
  "Galatians 6:9",
  "Zechariah 10:1",
  "James 5:7",
  "Genesis 8:22",
  "Micah 4:4",
  "Isaiah 58:11",
  "Psalm 136:1",
  "Proverbs 3:5",
  "Psalm 23:1-2",
  "Galatians 5:22-23",
  "Philippians 4:6",
  "Matthew 11:28",
  "Philippians 4:13",
  "Jeremiah 29:11",
  "Joshua 1:9",
  "Psalm 118:24"
]

// Map setting values to bible-api translation codes
const TRANSLATION_MAP = {
  'KJV': 'kjv',
  'ASV': 'asv',
  'WEB': 'web',
  'ESV': 'web',  // bible-api doesn't have ESV, fallback to WEB
  'NKJV': 'kjv', // bible-api doesn't have NKJV, fallback to KJV
  'NIV': 'web',  // bible-api doesn't have NIV, fallback to WEB
  'NLT': 'web',  // bible-api doesn't have NLT, fallback to WEB
  'NASB': 'web', // bible-api doesn't have NASB, fallback to WEB
}

function BibleVerse() {
  const [verse, setVerse] = useState(null)
  const [translation, setTranslation] = useState('KJV')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchVerse = async () => {
      try {
        // Get translation setting
        const settingsRes = await getSettings()
        const translationSetting = settingsRes.data?.settings?.bible_translation?.value || 'KJV'
        setTranslation(translationSetting)

        // Get verse of the day based on date
        const today = new Date()
        const dayOfYear = Math.floor(
          (today - new Date(today.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24)
        )
        const verseIndex = dayOfYear % VERSE_REFERENCES.length
        const reference = VERSE_REFERENCES[verseIndex]

        // Fetch from bible-api.com
        const apiTranslation = TRANSLATION_MAP[translationSetting] || 'kjv'
        const response = await fetch(
          `https://bible-api.com/${encodeURIComponent(reference)}?translation=${apiTranslation}`
        )

        if (response.ok) {
          const data = await response.json()
          setVerse({
            text: data.text?.trim() || '',
            reference: data.reference || reference
          })
        } else {
          // Fallback to just showing reference
          setVerse({
            text: 'Unable to load verse',
            reference: reference
          })
        }
      } catch (err) {
        console.error('Failed to fetch Bible verse:', err)
        // Show a default verse on error
        setVerse({
          text: 'He causes the grass to grow for the cattle, and vegetation for the service of man, that he may bring forth food from the earth.',
          reference: 'Psalm 104:14'
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
            — {verse.reference} ({translation})
          </p>
        </div>
        <Book className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5 opacity-0" />
      </div>
    </div>
  )
}

export default BibleVerse
