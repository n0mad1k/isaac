import React, { useState, useEffect } from 'react'
import { Book } from 'lucide-react'
import { getSettings } from '../services/api'

// Map setting values to bible-api.com translation codes
const TRANSLATION_MAP = {
  'KJV': 'kjv',
  'ASV': 'asv',
  'WEB': 'web',
  'BBE': 'bbe',
  'DARBY': 'darby',
  'YLT': 'ylt',
}

// Display names for translations
const TRANSLATION_NAMES = {
  'KJV': 'King James Version',
  'ASV': 'American Standard Version',
  'WEB': 'World English Bible',
  'BBE': 'Bible in Basic English',
  'DARBY': 'Darby Translation',
  'YLT': "Young's Literal Translation",
}

function BibleVerse() {
  const [verse, setVerse] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchVerse = async () => {
      try {
        // Get translation setting
        const settingsRes = await getSettings()
        const translationSetting = settingsRes.data?.settings?.bible_translation?.value || 'KJV'
        const apiTranslation = TRANSLATION_MAP[translationSetting] || 'kjv'

        // First, get verse of the day reference from OurManna
        const ourMannaRes = await fetch('https://beta.ourmanna.com/api/v1/get?format=json')

        if (!ourMannaRes.ok) {
          throw new Error('Failed to fetch verse of the day')
        }

        const ourMannaData = await ourMannaRes.json()
        const reference = ourMannaData.verse?.details?.reference

        if (!reference) {
          throw new Error('No verse reference returned')
        }

        // Now fetch that verse in the user's preferred translation
        const bibleApiRes = await fetch(
          `https://bible-api.com/${encodeURIComponent(reference)}?translation=${apiTranslation}`
        )

        if (bibleApiRes.ok) {
          const bibleData = await bibleApiRes.json()
          setVerse({
            text: bibleData.text?.trim() || ourMannaData.verse?.details?.text || '',
            reference: bibleData.reference || reference,
            version: translationSetting
          })
        } else {
          // Fallback to OurManna's text if bible-api fails
          setVerse({
            text: ourMannaData.verse?.details?.text || '',
            reference: reference,
            version: ourMannaData.verse?.details?.version || 'NIV'
          })
        }
      } catch (err) {
        console.error('Failed to fetch Bible verse:', err)
        // Show a default verse on error
        setVerse({
          text: 'He causes the grass to grow for the cattle, and vegetation for the service of man, that he may bring forth food from the earth.',
          reference: 'Psalm 104:14',
          version: 'KJV'
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
