import React, { useState, useEffect, useCallback } from 'react'
import {
  Plus, Search, PawPrint, Calendar, AlertCircle, ChevronDown, ChevronUp,
  MapPin, DollarSign, Scale, Clock, Check, X, Syringe, Scissors,
  Heart, Beef, Dog, Cat, Pencil, Save, Package, Copy, CalendarPlus,
  Trash2, Download, FileText
} from 'lucide-react'
import EventModal from '../components/EventModal'
import { useSettings } from '../contexts/SettingsContext'
import {
  getAnimals, createAnimal, updateAnimal, deleteAnimal, addAnimalCareLog,
  addAnimalExpense, getAnimalExpenses, createCareSchedule, completeCareSchedule,
  deleteCareSchedule, updateCareSchedule, createBulkCareSchedule,
  createAnimalFeed, updateAnimalFeed, deleteAnimalFeed, getFarmAreas,
  archiveLivestock, createSplitExpense, updateAnimalExpense, deleteAnimalExpense,
  exportAnimalExpenses, exportAllExpenses
} from '../services/api'
import { format, differenceInDays, parseISO, startOfDay } from 'date-fns'

// Predefined tags with colors using CSS variables
const ANIMAL_TAGS = {
  sick: { label: 'Sick', bgVar: '--color-error-600', textColor: '#ffffff' },
  injured: { label: 'Injured', bgVar: '--color-orange-600', textColor: '#ffffff' },
  pregnant: { label: 'Pregnant', bgVar: '--color-pink-600', textColor: '#ffffff' },
  nursing: { label: 'Nursing', bgVar: '--color-purple-600', textColor: '#ffffff' },
  quarantine: { label: 'Quarantine', bgVar: '--color-warning-600', textColor: '#000000' },
  for_sale: { label: 'For Sale', bgVar: '--color-success-600', textColor: '#ffffff' },
  new: { label: 'New', bgVar: '--color-blue-600', textColor: '#ffffff' },
  special_diet: { label: 'Special Diet', bgVar: '--color-teal-600', textColor: '#ffffff' },
  senior: { label: 'Senior', bgVar: '--color-text-muted', textColor: '#ffffff' },
  breeding: { label: 'Breeding', bgVar: '--color-pink-600', textColor: '#ffffff' },
}

// Helper to safely parse date strings without timezone shift
// Handles both "YYYY-MM-DD" (date only) and ISO datetime strings
const safeParseDate = (dateStr) => {
  if (!dateStr) return null
  // If it's a date-only string (YYYY-MM-DD), parse as local date
  if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [year, month, day] = dateStr.split('-').map(Number)
    return new Date(year, month - 1, day)
  }
  // Otherwise use parseISO for datetime strings
  return parseISO(dateStr)
}

// Inline editable field component
function EditableField({ label, value, field, type = 'text', options, onChange, placeholder, editing = true }) {
  const inputStyle = { backgroundColor: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)' }

  // Read-only mode
  if (!editing) {
    if (type === 'checkbox') {
      return (
        <div className="flex items-center gap-2">
          <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{label}:</span>
          <span style={{ color: value ? 'var(--color-success-600)' : 'var(--color-error-600)' }}>{value ? "Yes" : "No"}</span>
        </div>
      )
    }

    if (type === 'select' && options) {
      const selectedOption = options.find(opt => opt.value === value)
      const display = selectedOption?.label || value || '-'
      return (
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>{label}</label>
          <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{display}</div>
        </div>
      )
    }

    if (type === 'textarea' && value) {
      return (
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>{label}</label>
          <div className="text-sm whitespace-pre-wrap max-h-[200px] overflow-y-auto rounded p-2" style={{ color: 'var(--color-text-secondary)', backgroundColor: 'var(--color-bg-tertiary)' }}>
            {value}
          </div>
        </div>
      )
    }

    // Simple text display
    if (!value) return null
    return (
      <div>
        <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>{label}</label>
        <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{value}</div>
      </div>
    )
  }

  // Edit mode
  if (type === 'select' && options) {
    return (
      <div>
        <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>{label}</label>
        <select
          value={value || ''}
          onChange={(e) => onChange(field, e.target.value)}
          className="w-full px-2 py-1 rounded text-sm focus:outline-none focus:ring-1"
          style={inputStyle}
        >
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
    )
  }

  if (type === 'textarea') {
    return (
      <div>
        <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>{label}</label>
        <textarea
          value={value || ''}
          onChange={(e) => onChange(field, e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="w-full px-2 py-1 rounded text-sm focus:outline-none focus:ring-1"
          style={inputStyle}
        />
      </div>
    )
  }

  if (type === 'checkbox') {
    return (
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={value || false}
          onChange={(e) => onChange(field, e.target.checked)}
          className="w-4 h-4 rounded"
          style={{ backgroundColor: 'var(--color-bg-tertiary)', borderColor: 'var(--color-border-default)' }}
        />
        <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
      </label>
    )
  }

  return (
    <div>
      <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>{label}</label>
      <input
        type={type}
        value={value || ''}
        onChange={(e) => onChange(field, e.target.value)}
        placeholder={placeholder}
        className="w-full px-2 py-1 rounded text-sm focus:outline-none focus:ring-1"
        style={inputStyle}
      />
    </div>
  )
}

// Location select component with farm areas dropdown + custom option
function LocationSelect({ value, subValue, onChange, onSubChange, farmAreas, editing = true, label = "Location" }) {
  const [isCustom, setIsCustom] = useState(false)
  const [customValue, setCustomValue] = useState('')

  // Check if current value matches a farm area
  const matchingArea = farmAreas.find(a => a.name === value)
  const showCustomInput = isCustom || (value && !matchingArea)

  useEffect(() => {
    // If value doesn't match any farm area, it's a custom value
    if (value && !farmAreas.find(a => a.name === value)) {
      setIsCustom(true)
      setCustomValue(value)
    }
  }, [value, farmAreas])

  const handleSelectChange = (e) => {
    const selected = e.target.value
    if (selected === '__custom__') {
      setIsCustom(true)
      setCustomValue('')
    } else {
      setIsCustom(false)
      setCustomValue('')
      onChange(selected)
    }
  }

  const handleCustomChange = (e) => {
    const newValue = e.target.value
    setCustomValue(newValue)
    onChange(newValue)
  }

  const inputStyle = { backgroundColor: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)' }

  if (!editing) {
    const displayLocation = [value, subValue].filter(Boolean).join(' > ')
    return (
      <div>
        <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>{label}</label>
        <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{displayLocation || '-'}</div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div>
        {label && <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>{label}</label>}
        {showCustomInput ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={customValue}
              onChange={handleCustomChange}
              placeholder="Enter custom location"
              className="flex-1 px-2 py-1 rounded text-sm focus:outline-none focus:ring-1"
              style={inputStyle}
            />
            <button
              type="button"
              onClick={() => { setIsCustom(false); setCustomValue(''); onChange('') }}
              className="px-2 py-1 text-xs rounded"
              style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)' }}
              title="Use dropdown"
            >
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <select
            value={value || ''}
            onChange={handleSelectChange}
            className="w-full px-2 py-1 rounded text-sm focus:outline-none focus:ring-1"
            style={inputStyle}
          >
            <option value="">No location</option>
            {farmAreas.map(area => (
              <option key={area.id} value={area.name}>
                {area.is_sub_location ? `↳ ${area.name}` : area.name}
              </option>
            ))}
            <option value="__custom__">+ Custom location...</option>
          </select>
        )}
      </div>
      <div>
        <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Sub-location</label>
        <input
          type="text"
          value={subValue || ''}
          onChange={(e) => onSubChange(e.target.value)}
          placeholder="e.g., 3rd paddock, Stall 5"
          className="w-full px-2 py-1 rounded text-sm focus:outline-none focus:ring-1"
          style={inputStyle}
        />
      </div>
    </div>
  )
}

function Animals() {
  const [animals, setAnimals] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingAnimal, setEditingAnimal] = useState(null)
  const [duplicateAnimal, setDuplicateAnimal] = useState(null)
  const [expandedAnimal, setExpandedAnimal] = useState(null)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState('all') // all, pet, livestock
  const [groupByLocation, setGroupByLocation] = useState(true)
  const [collapsedLocations, setCollapsedLocations] = useState({})
  const [showExpenseForm, setShowExpenseForm] = useState(null) // animal_id or null
  const [showSplitExpenseForm, setShowSplitExpenseForm] = useState(false)
  const [showExpenseList, setShowExpenseList] = useState(null) // animal object or null
  const [editDateModal, setEditDateModal] = useState(null) // { animalId, field, label, currentDate }
  const [showCareScheduleForm, setShowCareScheduleForm] = useState(null) // animal_id or null
  const [editingCareSchedule, setEditingCareSchedule] = useState(null) // schedule object
  const [showBulkCareForm, setShowBulkCareForm] = useState(false)
  const [showFeedForm, setShowFeedForm] = useState(null) // animal_id or null
  const [editingFeed, setEditingFeed] = useState(null) // { animalId, ...feed }
  const [farmAreas, setFarmAreas] = useState([])
  const [showArchiveForm, setShowArchiveForm] = useState(null) // animal object or null
  const [showReminderFor, setShowReminderFor] = useState(null) // animal object for reminder modal
  const { formatTime } = useSettings()

  const fetchAnimals = async () => {
    try {
      const response = await getAnimals()
      setAnimals(response.data)
    } catch (error) {
      console.error('Failed to fetch animals:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchFarmAreas = async () => {
    try {
      const response = await getFarmAreas()
      setFarmAreas(response.data)
    } catch (error) {
      console.error('Failed to fetch farm areas:', error)
    }
  }

  useEffect(() => {
    fetchAnimals()
    fetchFarmAreas()
  }, [])

  const filteredAnimals = animals
    .filter((animal) => {
      const matchesSearch = animal.name.toLowerCase().includes(search.toLowerCase()) ||
        (animal.breed && animal.breed.toLowerCase().includes(search.toLowerCase()))

      if (activeTab === 'all') return matchesSearch
      return matchesSearch && animal.category === activeTab
    })
    .sort((a, b) => {
      // Sort by category first (pets before livestock), then by type, then by name
      if (a.category !== b.category) {
        return a.category === 'pet' ? -1 : 1
      }
      if (a.animal_type !== b.animal_type) {
        return a.animal_type.localeCompare(b.animal_type)
      }
      return a.name.localeCompare(b.name)
    })

  const pets = animals.filter(a => a.category === 'pet')
  const livestock = animals.filter(a => a.category === 'livestock')

  // Get location for an animal (farm_area name > pasture > "No Location")
  const getAnimalLocation = (animal) => {
    if (animal.farm_area?.name) return animal.farm_area.name
    if (animal.pasture) return animal.pasture
    return 'No Location'
  }

  // Group animals by location
  const animalsByLocation = filteredAnimals.reduce((acc, animal) => {
    const location = getAnimalLocation(animal)
    if (!acc[location]) acc[location] = []
    acc[location].push(animal)
    return acc
  }, {})

  // Sort locations alphabetically, but put "No Location" at the end
  const sortedAnimalLocations = Object.keys(animalsByLocation).sort((a, b) => {
    if (a === 'No Location') return 1
    if (b === 'No Location') return -1
    return a.localeCompare(b)
  })

  const toggleLocationCollapse = (location) => {
    setCollapsedLocations(prev => ({
      ...prev,
      [location]: !prev[location]
    }))
  }

  const getAnimalIcon = (type) => {
    const icons = {
      horse: '🐴',
      mini_horse: '🐴',
      cattle: '🐄',
      goat: '🐐',
      sheep: '🐑',
      pig: '🐷',
      chicken: '🐔',
      duck: '🦆',
      turkey: '🦃',
      rabbit: '🐰',
      dog: '🐕',
      cat: '🐈',
      donkey: '🫏',
      llama: '🦙',
      alpaca: '🦙',
    }
    return icons[type] || '🐾'
  }

  const getDaysUntil = (dateStr) => {
    if (!dateStr) return null
    const parsedDate = safeParseDate(dateStr)
    if (!parsedDate) return null
    // Use startOfDay for both dates to avoid time-of-day issues
    const days = differenceInDays(startOfDay(parsedDate), startOfDay(new Date()))
    return days
  }

  const getUrgencyStyle = (days) => {
    if (days === null) return { backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }
    if (days <= 0) return { backgroundColor: 'var(--color-error-100)', color: 'var(--color-error-600)', border: '1px solid var(--color-error-600)' }
    if (days <= 7) return { backgroundColor: 'var(--color-error-100)', color: 'var(--color-error-600)' }
    if (days <= 14) return { backgroundColor: 'var(--color-warning-100)', color: 'var(--color-warning-600)' }
    return { backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }
  }

  const logCare = async (animalId, careType, extraData = {}) => {
    try {
      await addAnimalCareLog(animalId, { care_type: careType, ...extraData })
      fetchAnimals() // Refresh to show updated dates
    } catch (error) {
      console.error('Failed to log care:', error)
      alert('Failed to log care action')
    }
  }

  const addExpense = async (animalId, expenseData) => {
    try {
      await addAnimalExpense(animalId, expenseData)
      setShowExpenseForm(null)
      fetchAnimals()
    } catch (error) {
      console.error('Failed to add expense:', error)
      alert('Failed to add expense')
    }
  }

  const handleDelete = async (animalId, animalName) => {
    if (!confirm(`Are you sure you want to remove ${animalName}? This action cannot be undone.`)) return
    try {
      await deleteAnimal(animalId)
      fetchAnimals()
    } catch (error) {
      console.error('Failed to delete animal:', error)
      alert('Failed to delete animal')
    }
  }

  const toggleTag = async (animalId, currentTags, tag) => {
    const tagList = currentTags || []
    const newTags = tagList.includes(tag)
      ? tagList.filter(t => t !== tag)
      : [...tagList, tag]
    try {
      await updateAnimal(animalId, { tags: newTags.join(',') })
      fetchAnimals()
    } catch (error) {
      console.error('Failed to update tags:', error)
    }
  }

  const updateCareDate = async (animalId, field, dateValue) => {
    try {
      await updateAnimal(animalId, { [field]: dateValue })
      setEditDateModal(null)
      fetchAnimals()
    } catch (error) {
      console.error('Failed to update date:', error)
      alert('Failed to update date')
    }
  }

  const handleAddCareSchedule = async (animalId, scheduleData) => {
    try {
      await createCareSchedule(animalId, scheduleData)
      setShowCareScheduleForm(null)
      fetchAnimals()
    } catch (error) {
      console.error('Failed to add care schedule:', error)
      alert('Failed to add care schedule')
    }
  }

  const handleCompleteCareSchedule = async (animalId, scheduleId) => {
    try {
      await completeCareSchedule(animalId, scheduleId)
      fetchAnimals()
    } catch (error) {
      console.error('Failed to complete care schedule:', error)
      alert('Failed to complete care schedule')
    }
  }

  const handleDeleteCareSchedule = async (animalId, scheduleId) => {
    if (!confirm('Delete this care schedule item?')) return
    try {
      await deleteCareSchedule(animalId, scheduleId)
      fetchAnimals()
    } catch (error) {
      console.error('Failed to delete care schedule:', error)
      alert('Failed to delete care schedule')
    }
  }

  const handleUpdateCareSchedule = async (animalId, scheduleId, data) => {
    try {
      await updateCareSchedule(animalId, scheduleId, data)
      setEditingCareSchedule(null)
      fetchAnimals()
    } catch (error) {
      console.error('Failed to update care schedule:', error)
      alert('Failed to update care schedule')
    }
  }

  const handleBulkCareSchedule = async (data) => {
    try {
      await createBulkCareSchedule(data)
      setShowBulkCareForm(false)
      fetchAnimals()
    } catch (error) {
      console.error('Failed to create bulk care schedule:', error)
      alert('Failed to create care schedule')
    }
  }

  const handleAddFeed = async (animalId, feedData) => {
    try {
      await createAnimalFeed(animalId, feedData)
      setShowFeedForm(null)
      fetchAnimals()
    } catch (error) {
      console.error('Failed to add feed:', error)
      alert('Failed to add feed')
    }
  }

  const handleUpdateFeed = async (animalId, feedId, data) => {
    try {
      await updateAnimalFeed(animalId, feedId, data)
      setEditingFeed(null)
      fetchAnimals()
    } catch (error) {
      console.error('Failed to update feed:', error)
      alert('Failed to update feed')
    }
  }

  const handleDeleteFeed = async (animalId, feedId) => {
    if (!confirm('Delete this feed entry?')) return
    try {
      await deleteAnimalFeed(animalId, feedId)
      fetchAnimals()
    } catch (error) {
      console.error('Failed to delete feed:', error)
      alert('Failed to delete feed')
    }
  }

  const handleArchiveLivestock = async (data) => {
    try {
      await archiveLivestock(data)
      setShowArchiveForm(null)
      setExpandedAnimal(null)
      fetchAnimals()
    } catch (error) {
      console.error('Failed to archive livestock:', error)
      alert('Failed to archive livestock')
    }
  }

  // Stats
  const stats = {
    totalPets: pets.length,
    totalLivestock: livestock.length,
    needsAttention: animals.filter(a => {
      // Check care schedules for overdue items
      const hasOverdueCare = a.care_schedules?.some(cs => cs.is_overdue)
      // Check slaughter date for livestock
      const slaughterSoon = a.days_until_slaughter !== null && a.days_until_slaughter <= 14
      return hasOverdueCare || slaughterSoon
    }).length,
    totalExpenses: animals.reduce((sum, a) => sum + (a.total_expenses || 0), 0),
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-farm-green"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
          <PawPrint className="w-7 h-7" style={{ color: 'var(--color-teal-600)' }} />
          Animals
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBulkCareForm(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm"
            style={{ backgroundColor: 'var(--color-teal-100)', color: 'var(--color-teal-600)' }}
          >
            <Calendar className="w-4 h-4" />
            Bulk Care
          </button>
          <button
            onClick={() => setShowSplitExpenseForm(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm"
            style={{ backgroundColor: 'var(--color-success-100)', color: 'var(--color-success-600)' }}
          >
            <DollarSign className="w-4 h-4" />
            Split Expense
          </button>
          <a
            href={exportAllExpenses()}
            className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm"
            style={{ backgroundColor: 'var(--color-purple-100)', color: 'var(--color-purple-600)' }}
          >
            <Download className="w-4 h-4" />
            Export All
          </a>
          <button
            onClick={() => { setEditingAnimal(null); setShowForm(true) }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
            style={{ backgroundColor: 'var(--color-success-600)', color: '#ffffff' }}
          >
            <Plus className="w-5 h-5" />
            Add Animal
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
          <div className="flex items-center gap-2 mb-1">
            <Heart className="w-5 h-5" style={{ color: 'var(--color-error-600)' }} />
            <span className="text-2xl font-bold" style={{ color: 'var(--color-error-600)' }}>{stats.totalPets}</span>
          </div>
          <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Pets</div>
        </div>
        <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
          <div className="flex items-center gap-2 mb-1">
            <Beef className="w-5 h-5" style={{ color: 'var(--color-gold-600)' }} />
            <span className="text-2xl font-bold" style={{ color: 'var(--color-gold-600)' }}>{stats.totalLivestock}</span>
          </div>
          <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Livestock</div>
        </div>
        <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
          <div className="text-2xl font-bold" style={{ color: 'var(--color-error-600)' }}>{stats.needsAttention}</div>
          <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Need Attention</div>
        </div>
        <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}>
          <div className="flex items-center gap-1">
            <DollarSign className="w-5 h-5" style={{ color: 'var(--color-success-600)' }} />
            <span className="text-2xl font-bold" style={{ color: 'var(--color-success-600)' }}>
              {stats.totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
          </div>
          <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Total Expenses</div>
        </div>
      </div>

      {/* Tabs and Filters */}
      <div className="flex flex-wrap gap-4">
        {/* Category Tabs */}
        <div className="flex rounded-lg p-1" style={{ backgroundColor: 'var(--color-bg-surface-muted)' }}>
          <button
            onClick={() => setActiveTab('all')}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: activeTab === 'all' ? 'var(--color-green-600)' : 'transparent',
              color: activeTab === 'all' ? '#ffffff' : 'var(--color-text-secondary)'
            }}
          >
            All ({animals.length})
          </button>
          <button
            onClick={() => setActiveTab('pet')}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
            style={{
              backgroundColor: activeTab === 'pet' ? 'var(--color-error-600)' : 'transparent',
              color: activeTab === 'pet' ? '#ffffff' : 'var(--color-text-secondary)'
            }}
          >
            <Heart className="w-4 h-4" /> Pets ({pets.length})
          </button>
          <button
            onClick={() => setActiveTab('livestock')}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
            style={{
              backgroundColor: activeTab === 'livestock' ? 'var(--color-gold-600)' : 'transparent',
              color: activeTab === 'livestock' ? '#ffffff' : 'var(--color-text-secondary)'
            }}
          >
            <Beef className="w-4 h-4" /> Livestock ({livestock.length})
          </button>
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{ color: 'var(--color-text-muted)' }} />
          <input
            type="text"
            placeholder="Search animals..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2"
            style={{ backgroundColor: 'var(--color-input-bg)', border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)' }}
          />
        </div>

        {/* Group by Location Toggle */}
        <button
          onClick={() => setGroupByLocation(!groupByLocation)}
          className="px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
          style={{
            backgroundColor: groupByLocation ? 'var(--color-green-600)' : 'var(--color-bg-surface)',
            border: groupByLocation ? 'none' : '1px solid var(--color-border-default)',
            color: groupByLocation ? '#ffffff' : 'var(--color-text-secondary)'
          }}
        >
          <MapPin className="w-4 h-4" />
          Group by Location
        </button>
      </div>

      {/* Animal List */}
      {filteredAnimals.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <PawPrint className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>No animals found. Add your first animal!</p>
        </div>
      ) : groupByLocation ? (
        // Grouped by location view
        <div className="space-y-4">
          {sortedAnimalLocations.map((location) => (
            <div key={location} className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
              <button
                onClick={() => toggleLocationCollapse(location)}
                className="w-full px-4 py-3 flex items-center justify-between transition-colors"
                style={{ backgroundColor: 'var(--color-bg-tertiary)' }}
              >
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5" style={{ color: 'var(--color-teal-600)' }} />
                  <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{location}</span>
                  <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>({animalsByLocation[location].length} animals)</span>
                </div>
                {collapsedLocations[location] ? (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                )}
              </button>
              {!collapsedLocations[location] && (
                <div className="p-2 space-y-1">
                  {animalsByLocation[location].map((animal) => (
                    <AnimalCard
                      key={animal.id}
                      animal={animal}
                      farmAreas={farmAreas}
                      expanded={expandedAnimal === animal.id}
                      onToggle={() => setExpandedAnimal(expandedAnimal === animal.id ? null : animal.id)}
                      onLogCare={logCare}
                      onDelete={() => handleDelete(animal.id, animal.name)}
                      onDuplicate={(animal) => setDuplicateAnimal(animal)}
                      onAddExpense={() => setShowExpenseForm(animal.id)}
                      onViewExpenses={() => setShowExpenseList(animal)}
                      onEditDate={setEditDateModal}
                      onToggleTag={(tag) => toggleTag(animal.id, animal.tags, tag)}
                      onAddCareSchedule={() => setShowCareScheduleForm(animal.id)}
                      onCompleteCareSchedule={(scheduleId) => handleCompleteCareSchedule(animal.id, scheduleId)}
                      onDeleteCareSchedule={(scheduleId) => handleDeleteCareSchedule(animal.id, scheduleId)}
                      onEditCareSchedule={(schedule) => setEditingCareSchedule({ animalId: animal.id, ...schedule })}
                      onAddFeed={() => setShowFeedForm(animal.id)}
                      onEditFeed={(feed) => setEditingFeed({ animalId: animal.id, ...feed })}
                      onDeleteFeed={(feedId) => handleDeleteFeed(animal.id, feedId)}
                      onSave={fetchAnimals}
                      onArchive={(animal) => setShowArchiveForm(animal)}
                      onAddReminder={(animal) => setShowReminderFor(animal)}
                      getAnimalIcon={getAnimalIcon}
                      getDaysUntil={getDaysUntil}
                      getUrgencyStyle={getUrgencyStyle}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        // Flat list view
        <div className="space-y-1">
          {filteredAnimals.map((animal) => (
            <AnimalCard
              key={animal.id}
              animal={animal}
              farmAreas={farmAreas}
              expanded={expandedAnimal === animal.id}
              onToggle={() => setExpandedAnimal(expandedAnimal === animal.id ? null : animal.id)}
              onLogCare={logCare}
              onDelete={() => handleDelete(animal.id, animal.name)}
              onDuplicate={(animal) => setDuplicateAnimal(animal)}
              onAddExpense={() => setShowExpenseForm(animal.id)}
              onViewExpenses={() => setShowExpenseList(animal)}
              onEditDate={setEditDateModal}
              onToggleTag={(tag) => toggleTag(animal.id, animal.tags, tag)}
              onAddCareSchedule={() => setShowCareScheduleForm(animal.id)}
              onCompleteCareSchedule={(scheduleId) => handleCompleteCareSchedule(animal.id, scheduleId)}
              onDeleteCareSchedule={(scheduleId) => handleDeleteCareSchedule(animal.id, scheduleId)}
              onEditCareSchedule={(schedule) => setEditingCareSchedule({ animalId: animal.id, ...schedule })}
              onAddFeed={() => setShowFeedForm(animal.id)}
              onEditFeed={(feed) => setEditingFeed({ animalId: animal.id, ...feed })}
              onDeleteFeed={(feedId) => handleDeleteFeed(animal.id, feedId)}
              onSave={fetchAnimals}
              onAddReminder={(animal) => setShowReminderFor(animal)}
              onArchive={(animal) => setShowArchiveForm(animal)}
              getAnimalIcon={getAnimalIcon}
              getDaysUntil={getDaysUntil}
              getUrgencyStyle={getUrgencyStyle}
            />
          ))}
        </div>
      )}

      {/* Add/Edit Animal Modal */}
      {showForm && (
        <AnimalFormModal
          animal={editingAnimal}
          farmAreas={farmAreas}
          onClose={() => { setShowForm(false); setEditingAnimal(null) }}
          onSave={() => { setShowForm(false); setEditingAnimal(null); fetchAnimals() }}
        />
      )}

      {/* Duplicate Animal Modal */}
      {duplicateAnimal && (
        <AnimalFormModal
          animal={duplicateAnimal}
          farmAreas={farmAreas}
          isDuplicate={true}
          onClose={() => setDuplicateAnimal(null)}
          onSave={() => { setDuplicateAnimal(null); fetchAnimals() }}
        />
      )}

      {/* Add Expense Modal */}
      {showExpenseForm && (
        <ExpenseFormModal
          animalId={showExpenseForm}
          animalName={animals.find(a => a.id === showExpenseForm)?.name}
          animals={animals}
          onClose={() => setShowExpenseForm(null)}
          onSave={(data) => addExpense(showExpenseForm, data)}
          onSplitSave={async (data) => {
            try {
              await createSplitExpense(data)
              setShowExpenseForm(null)
              fetchAnimals()
            } catch (error) {
              console.error('Failed to create split expense:', error)
              alert('Failed to create split expense: ' + (error.response?.data?.detail || error.message))
            }
          }}
        />
      )}

      {/* Split Expense Modal */}
      {showSplitExpenseForm && (
        <SplitExpenseFormModal
          animals={animals}
          onClose={() => setShowSplitExpenseForm(false)}
          onSave={async (data) => {
            try {
              await createSplitExpense(data)
              setShowSplitExpenseForm(false)
              fetchAnimals()
            } catch (error) {
              console.error('Failed to create split expense:', error)
              alert('Failed to create split expense: ' + (error.response?.data?.detail || error.message))
            }
          }}
        />
      )}

      {/* Expense List Modal */}
      {showExpenseList && (
        <ExpenseListModal
          animal={showExpenseList}
          onClose={() => setShowExpenseList(null)}
          onUpdate={fetchAnimals}
        />
      )}

      {/* Edit Date Modal */}
      {editDateModal && (
        <EditDateModal
          label={editDateModal.label}
          currentDate={editDateModal.currentDate}
          onClose={() => setEditDateModal(null)}
          onSave={(date) => updateCareDate(editDateModal.animalId, editDateModal.field, date)}
        />
      )}

      {/* Add Care Schedule Modal */}
      {showCareScheduleForm && (
        <CareScheduleFormModal
          animalName={animals.find(a => a.id === showCareScheduleForm)?.name}
          onClose={() => setShowCareScheduleForm(null)}
          onSave={(data) => handleAddCareSchedule(showCareScheduleForm, data)}
        />
      )}

      {/* Edit Care Schedule Modal */}
      {editingCareSchedule && (
        <CareScheduleFormModal
          schedule={editingCareSchedule}
          animalName={animals.find(a => a.id === editingCareSchedule.animalId)?.name}
          onClose={() => setEditingCareSchedule(null)}
          onSave={(data) => handleUpdateCareSchedule(editingCareSchedule.animalId, editingCareSchedule.id, data)}
        />
      )}

      {/* Bulk Care Schedule Modal */}
      {showBulkCareForm && (
        <BulkCareScheduleModal
          animals={animals}
          onClose={() => setShowBulkCareForm(false)}
          onSave={handleBulkCareSchedule}
        />
      )}

      {/* Add Feed Modal */}
      {showFeedForm && (
        <FeedFormModal
          animalName={animals.find(a => a.id === showFeedForm)?.name}
          onClose={() => setShowFeedForm(null)}
          onSave={(data) => handleAddFeed(showFeedForm, data)}
        />
      )}

      {/* Edit Feed Modal */}
      {editingFeed && (
        <FeedFormModal
          feed={editingFeed}
          animalName={animals.find(a => a.id === editingFeed.animalId)?.name}
          onClose={() => setEditingFeed(null)}
          onSave={(data) => handleUpdateFeed(editingFeed.animalId, editingFeed.id, data)}
        />
      )}

      {/* Archive Livestock Modal */}
      {showArchiveForm && (
        <ArchiveFormModal
          animal={showArchiveForm}
          onClose={() => setShowArchiveForm(null)}
          onSave={handleArchiveLivestock}
        />
      )}

      {/* Add Reminder Modal */}
      {showReminderFor && (
        <EventModal
          preselectedEntity={{ type: 'animal', id: showReminderFor.id, name: showReminderFor.name }}
          onClose={() => setShowReminderFor(null)}
          onSaved={() => setShowReminderFor(null)}
        />
      )}
    </div>
  )
}


// Animal Type options
const ANIMAL_TYPE_OPTIONS = [
  { value: 'dog', label: 'Dog' },
  { value: 'cat', label: 'Cat' },
  { value: 'horse', label: 'Horse' },
  { value: 'mini_horse', label: 'Mini Horse' },
  { value: 'donkey', label: 'Donkey' },
  { value: 'llama', label: 'Llama' },
  { value: 'alpaca', label: 'Alpaca' },
  { value: 'cattle', label: 'Cattle' },
  { value: 'goat', label: 'Goat' },
  { value: 'sheep', label: 'Sheep' },
  { value: 'pig', label: 'Pig' },
  { value: 'chicken', label: 'Chicken' },
  { value: 'duck', label: 'Duck' },
  { value: 'turkey', label: 'Turkey' },
  { value: 'rabbit', label: 'Rabbit' },
  { value: 'other', label: 'Other' },
]

const CATEGORY_OPTIONS = [
  { value: 'pet', label: 'Pet' },
  { value: 'livestock', label: 'Livestock' },
]

// Sex options by animal type - more specific terminology
const SEX_OPTIONS_BY_TYPE = {
  horse: [
    { value: '', label: '-' },
    { value: 'mare', label: 'Mare' },
    { value: 'stallion', label: 'Stallion' },
    { value: 'gelding', label: 'Gelding' },
    { value: 'filly', label: 'Filly (young female)' },
    { value: 'colt', label: 'Colt (young male)' },
  ],
  mini_horse: [
    { value: '', label: '-' },
    { value: 'mare', label: 'Mare' },
    { value: 'stallion', label: 'Stallion' },
    { value: 'gelding', label: 'Gelding' },
    { value: 'filly', label: 'Filly (young female)' },
    { value: 'colt', label: 'Colt (young male)' },
  ],
  donkey: [
    { value: '', label: '-' },
    { value: 'jenny', label: 'Jenny (female)' },
    { value: 'jack', label: 'Jack (intact male)' },
    { value: 'gelding', label: 'Gelding' },
  ],
  cattle: [
    { value: '', label: '-' },
    { value: 'cow', label: 'Cow' },
    { value: 'bull', label: 'Bull' },
    { value: 'steer', label: 'Steer' },
    { value: 'heifer', label: 'Heifer (young female)' },
    { value: 'calf', label: 'Calf' },
  ],
  goat: [
    { value: '', label: '-' },
    { value: 'doe', label: 'Doe (female)' },
    { value: 'buck', label: 'Buck (intact male)' },
    { value: 'wether', label: 'Wether (castrated male)' },
    { value: 'kid', label: 'Kid' },
  ],
  sheep: [
    { value: '', label: '-' },
    { value: 'ewe', label: 'Ewe (female)' },
    { value: 'ram', label: 'Ram (intact male)' },
    { value: 'wether', label: 'Wether (castrated male)' },
    { value: 'lamb', label: 'Lamb' },
  ],
  pig: [
    { value: '', label: '-' },
    { value: 'sow', label: 'Sow (female)' },
    { value: 'boar', label: 'Boar (intact male)' },
    { value: 'barrow', label: 'Barrow (castrated male)' },
    { value: 'gilt', label: 'Gilt (young female)' },
    { value: 'piglet', label: 'Piglet' },
  ],
  chicken: [
    { value: '', label: '-' },
    { value: 'hen', label: 'Hen' },
    { value: 'rooster', label: 'Rooster' },
    { value: 'pullet', label: 'Pullet (young hen)' },
    { value: 'cockerel', label: 'Cockerel (young rooster)' },
    { value: 'chick', label: 'Chick' },
  ],
  duck: [
    { value: '', label: '-' },
    { value: 'hen', label: 'Hen (female)' },
    { value: 'drake', label: 'Drake (male)' },
    { value: 'duckling', label: 'Duckling' },
  ],
  turkey: [
    { value: '', label: '-' },
    { value: 'hen', label: 'Hen' },
    { value: 'tom', label: 'Tom (male)' },
    { value: 'poult', label: 'Poult (young)' },
  ],
  rabbit: [
    { value: '', label: '-' },
    { value: 'doe', label: 'Doe (female)' },
    { value: 'buck', label: 'Buck (male)' },
    { value: 'kit', label: 'Kit (young)' },
  ],
  dog: [
    { value: '', label: '-' },
    { value: 'female', label: 'Female' },
    { value: 'male', label: 'Male' },
    { value: 'spayed', label: 'Spayed Female' },
    { value: 'neutered', label: 'Neutered Male' },
  ],
  cat: [
    { value: '', label: '-' },
    { value: 'female', label: 'Female (Queen)' },
    { value: 'male', label: 'Male (Tom)' },
    { value: 'spayed', label: 'Spayed Female' },
    { value: 'neutered', label: 'Neutered Male' },
  ],
  llama: [
    { value: '', label: '-' },
    { value: 'female', label: 'Female' },
    { value: 'male', label: 'Male (intact)' },
    { value: 'gelding', label: 'Gelding' },
    { value: 'cria', label: 'Cria (young)' },
  ],
  alpaca: [
    { value: '', label: '-' },
    { value: 'female', label: 'Female' },
    { value: 'male', label: 'Male (intact)' },
    { value: 'gelding', label: 'Gelding' },
    { value: 'cria', label: 'Cria (young)' },
  ],
  default: [
    { value: '', label: '-' },
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
    { value: 'neutered', label: 'Neutered Male' },
    { value: 'spayed', label: 'Spayed Female' },
  ],
}

// Get sex options for a specific animal type
const getSexOptions = (animalType) => {
  return SEX_OPTIONS_BY_TYPE[animalType] || SEX_OPTIONS_BY_TYPE.default
}

// Animal Card Component with inline editing
function AnimalCard({
  animal, farmAreas = [], expanded, onToggle, onLogCare, onDelete, onDuplicate, onAddExpense, onViewExpenses, onEditDate, onToggleTag,
  onAddCareSchedule, onCompleteCareSchedule, onDeleteCareSchedule, onEditCareSchedule,
  onAddFeed, onEditFeed, onDeleteFeed, onSave, onArchive, onAddReminder, getAnimalIcon, getDaysUntil, getUrgencyStyle
}) {
  // Local state for inline editing
  const [editData, setEditData] = useState(null)
  const [saving, setSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  // Track animal updates to reset editData
  const [lastAnimalUpdate, setLastAnimalUpdate] = useState(animal.updated_at)

  // Reset editData when animal is updated externally
  useEffect(() => {
    if (animal.updated_at !== lastAnimalUpdate) {
      setLastAnimalUpdate(animal.updated_at)
      setEditData(null)
      setIsEditing(false)
    }
  }, [animal.updated_at, lastAnimalUpdate])

  // Exit edit mode when card is collapsed
  useEffect(() => {
    if (!expanded) {
      setIsEditing(false)
    }
  }, [expanded])

  // Initialize edit data when expanded
  useEffect(() => {
    if (expanded && !editData) {
      setEditData({
        name: animal.name || '',
        animal_type: animal.animal_type || 'dog',
        category: animal.category || 'pet',
        breed: animal.breed || '',
        color: animal.color || '',
        tag_number: animal.tag_number || '',
        microchip: animal.microchip || '',
        sex: animal.sex || '',
        birth_date: animal.birth_date || '',
        acquisition_date: animal.acquisition_date || '',
        current_weight: animal.current_weight || '',
        pasture: animal.pasture || '',
        sub_location: animal.sub_location || '',
        farm_area_id: animal.farm_area_id || '',
        notes: animal.notes || '',
        special_instructions: animal.special_instructions || '',
        target_weight: animal.target_weight || '',
        slaughter_date: animal.slaughter_date || '',
        processor: animal.processor || '',
        pickup_date: animal.pickup_date || '',
        worming_frequency_days: animal.worming_frequency_days || '',
        vaccination_frequency_days: animal.vaccination_frequency_days || '',
        hoof_trim_frequency_days: animal.hoof_trim_frequency_days || '',
        dental_frequency_days: animal.dental_frequency_days || '',
        cold_sensitive: animal.cold_sensitive || false,
        min_temp: animal.min_temp || '',
        needs_blanket_below: animal.needs_blanket_below || '',
      })
    }
  }, [expanded, animal])

  const handleFieldChange = (field, value) => {
    setEditData(prev => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const data = {
        ...editData,
        current_weight: editData.current_weight ? parseFloat(editData.current_weight) : null,
        target_weight: editData.target_weight ? parseFloat(editData.target_weight) : null,
        worming_frequency_days: editData.worming_frequency_days ? parseInt(editData.worming_frequency_days) : null,
        vaccination_frequency_days: editData.vaccination_frequency_days ? parseInt(editData.vaccination_frequency_days) : null,
        hoof_trim_frequency_days: editData.hoof_trim_frequency_days ? parseInt(editData.hoof_trim_frequency_days) : null,
        dental_frequency_days: editData.dental_frequency_days ? parseInt(editData.dental_frequency_days) : null,
        min_temp: editData.min_temp ? parseFloat(editData.min_temp) : null,
        needs_blanket_below: editData.needs_blanket_below ? parseFloat(editData.needs_blanket_below) : null,
        birth_date: editData.birth_date || null,
        acquisition_date: editData.acquisition_date || null,
        slaughter_date: editData.slaughter_date || null,
        pickup_date: editData.pickup_date || null,
        farm_area_id: editData.farm_area_id ? parseInt(editData.farm_area_id) : null,
      }
      await updateAnimal(animal.id, data)
      setIsEditing(false)
      if (onSave) onSave()
    } catch (error) {
      console.error('Failed to save:', error)
      alert('Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setEditData({
      name: animal.name || '',
      animal_type: animal.animal_type || 'dog',
      category: animal.category || 'pet',
      breed: animal.breed || '',
      color: animal.color || '',
      tag_number: animal.tag_number || '',
      microchip: animal.microchip || '',
      sex: animal.sex || '',
      birth_date: animal.birth_date || '',
      acquisition_date: animal.acquisition_date || '',
      current_weight: animal.current_weight || '',
      pasture: animal.pasture || '',
      sub_location: animal.sub_location || '',
      farm_area_id: animal.farm_area_id || '',
      notes: animal.notes || '',
      special_instructions: animal.special_instructions || '',
      target_weight: animal.target_weight || '',
      slaughter_date: animal.slaughter_date || '',
      processor: animal.processor || '',
      pickup_date: animal.pickup_date || '',
      worming_frequency_days: animal.worming_frequency_days || '',
      vaccination_frequency_days: animal.vaccination_frequency_days || '',
      hoof_trim_frequency_days: animal.hoof_trim_frequency_days || '',
      dental_frequency_days: animal.dental_frequency_days || '',
      cold_sensitive: animal.cold_sensitive || false,
      min_temp: animal.min_temp || '',
      needs_blanket_below: animal.needs_blanket_below || '',
    })
    setIsEditing(false)
  }

  const isPet = (editData?.category || animal.category) === 'pet'
  const isLivestock = (editData?.category || animal.category) === 'livestock'
  const slaughterDays = getDaysUntil(animal.slaughter_date)
  const animalTags = animal.tags || []

  // Check for overdue care items from dynamic care schedules
  const overdueItems = (animal.care_schedules || [])
    .filter(cs => cs.is_overdue)
    .map(cs => cs.name)

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{
        backgroundColor: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border-default)',
        borderLeft: isPet ? '4px solid var(--color-pink-600)' : isLivestock ? '4px solid var(--color-orange-600)' : undefined
      }}
    >
      {/* Compact Card Header - flows naturally */}
      <div
        className="px-4 py-2 flex items-center gap-2 cursor-pointer"
        onClick={onToggle}
      >
        {/* Icon */}
        <span className="text-xl flex-shrink-0">{getAnimalIcon(animal.animal_type)}</span>

        {/* 1. Name */}
        <span className="font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>{animal.name}</span>

        {/* 2. Color + Type together (grey) like "Black Horse" */}
        {(animal.color || animal.animal_type) && (
          <>
            <span style={{ color: 'var(--color-border-strong)' }}>·</span>
            <span className="text-xs truncate capitalize" style={{ color: 'var(--color-text-muted)' }}>
              {[animal.color, animal.animal_type?.replace('_', ' ')].filter(Boolean).join(' ')}
            </span>
          </>
        )}

        {/* 3. Location: Farm Area or Pasture */}
        {(animal.farm_area || animal.pasture) && (
          <>
            <span className="text-gray-600">·</span>
            <span className="text-xs flex items-center gap-1" style={{ color: 'var(--color-green-600)' }}>
              <MapPin className="w-3 h-3" />
              {animal.farm_area?.name || animal.pasture}
            </span>
          </>
        )}

        {/* 4. Feeding Info: amount, type, frequency */}
        {(animal.feeds?.length > 0 || animal.feed_type) && (
          <>
            <span className="text-gray-600">·</span>
            <span className="text-sm truncate" style={{ color: 'var(--color-teal-600)' }}>
              {animal.feeds && animal.feeds.length > 0
                ? animal.feeds.map(f => [f.amount, f.feed_type, f.frequency].filter(Boolean).join(' ')).join(' | ')
                : [animal.feed_amount, animal.feed_type, animal.feed_frequency].filter(Boolean).join(' ')
              }
            </span>
          </>
        )}

        {/* 5. Tags */}
        {animalTags.slice(0, 2).map(tag => {
          const tagInfo = ANIMAL_TAGS[tag] || { label: tag, bgVar: '--color-bg-tertiary', textColor: 'var(--color-text-primary)' }
          return (
            <span
              key={tag}
              className="text-xs px-1.5 py-0.5 rounded flex-shrink-0"
              style={{ backgroundColor: `var(${tagInfo.bgVar})`, color: tagInfo.textColor }}
            >
              {tagInfo.label}
            </span>
          )
        })}

        {/* 6. Special Instructions if present */}
        {animal.special_instructions && (
          <>
            <span className="text-gray-600">·</span>
            <span className="text-xs truncate max-w-[200px]" style={{ color: 'var(--color-warning-600)' }}>
              {animal.special_instructions}
            </span>
          </>
        )}

        {/* Spacer to push status indicators right */}
        <span className="flex-1"></span>

        {/* Status Indicators - right side: notes, slaughter, cost, overdue */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {animal.notes && (
            <span
              className="text-xs px-1.5 py-0.5 rounded"
              style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-muted)' }}
              title={animal.notes}
            >
              See Notes
            </span>
          )}
          {isLivestock && slaughterDays !== null && (
            <span className="text-xs px-2 py-1 rounded" style={getUrgencyStyle(slaughterDays)}>
              {slaughterDays <= 0 ? 'Ready' : `${slaughterDays} days until slaughter`}
            </span>
          )}
          {animal.total_expenses > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); onViewExpenses() }}
              className="text-xs px-2 py-1 rounded transition-colors"
              style={{ backgroundColor: 'var(--color-success-100)', color: 'var(--color-success-600)' }}
              title="View expenses"
            >
              ${animal.total_expenses.toFixed(0)}
            </button>
          )}
          {overdueItems.length > 0 && (
            <span
              className="text-xs px-2 py-1 rounded"
              style={{ backgroundColor: 'var(--color-error-100)', color: 'var(--color-error-600)', border: '1px solid var(--color-error-600)' }}
            >
              {overdueItems.length} due
            </span>
          )}
        </div>

        {/* Expand Icon */}
        {expanded ? (
          <ChevronUp className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--color-text-muted)' }} />
        ) : (
          <ChevronDown className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--color-text-muted)' }} />
        )}
      </div>

      {/* Expanded Details */}
      {expanded && editData && (
        <div className="px-4 pb-4 pt-4 space-y-4" style={{ borderTop: '1px solid var(--color-border-default)' }}>

          {/* Action Buttons - Edit/Save/Cancel, Quick actions, Delete */}
          <div className="flex gap-2 flex-wrap">
            {isEditing ? (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); handleSave() }}
                  disabled={saving}
                  className="px-3 py-1.5 rounded text-sm transition-colors flex items-center gap-1 disabled:opacity-50"
                  style={{ backgroundColor: 'var(--color-success-600)', color: '#ffffff' }}
                >
                  <Save className="w-3 h-3" /> {saving ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleCancel() }}
                  className="px-3 py-1.5 rounded text-sm transition-colors flex items-center gap-1"
                  style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-default)' }}
                >
                  <X className="w-3 h-3" /> Cancel
                </button>
              </>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); setIsEditing(true) }}
                className="px-3 py-1.5 rounded text-sm transition-colors flex items-center gap-1"
                style={{ backgroundColor: 'var(--color-blue-600)', color: '#ffffff' }}
              >
                <Pencil className="w-3 h-3" /> Edit
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onAddExpense() }}
              className="px-3 py-1.5 rounded text-sm transition-colors flex items-center gap-1"
              style={{ backgroundColor: 'var(--color-success-600)', color: '#ffffff' }}
            >
              <DollarSign className="w-3 h-3" /> Add Expense
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onViewExpenses() }}
              className="px-3 py-1.5 rounded text-sm transition-colors flex items-center gap-1"
              style={{ backgroundColor: 'var(--color-purple-600)', color: '#ffffff' }}
            >
              <FileText className="w-3 h-3" /> View Expenses
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                const weight = prompt('Enter current weight (lbs):')
                if (weight) {
                  handleFieldChange('current_weight', weight)
                  onLogCare(animal.id, 'weighed', { weight: parseFloat(weight) })
                }
              }}
              className="px-3 py-1.5 rounded text-sm transition-colors flex items-center gap-1"
              style={{ backgroundColor: 'var(--color-blue-600)', color: '#ffffff' }}
            >
              <Scale className="w-3 h-3" /> Log Weight
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                const notes = prompt('Vet visit notes:')
                if (notes) onLogCare(animal.id, 'vet_visit', { notes })
              }}
              className="px-3 py-1.5 rounded text-sm transition-colors flex items-center gap-1"
              style={{ backgroundColor: 'var(--color-error-600)', color: '#ffffff' }}
            >
              <Heart className="w-3 h-3" /> Vet Visit
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDuplicate(animal) }}
              className="px-3 py-1.5 rounded text-sm transition-colors flex items-center gap-1"
              style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-default)' }}
            >
              <Copy className="w-3 h-3" /> Duplicate
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onAddReminder(animal) }}
              className="px-3 py-1.5 rounded text-sm transition-colors flex items-center gap-1"
              style={{ backgroundColor: 'var(--color-teal-600)', color: '#ffffff' }}
            >
              <CalendarPlus className="w-3 h-3" /> Add Reminder
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete() }}
              className="px-3 py-1.5 rounded text-sm transition-colors flex items-center gap-1 ml-auto"
              style={{ backgroundColor: 'var(--color-error-600)', color: '#ffffff' }}
            >
              <X className="w-3 h-3" /> Delete
            </button>
          </div>

          {/* Inline Editable Details */}
          <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
            <h4 className="text-sm font-medium mb-3" style={{ color: 'var(--color-text-muted)' }}>Details</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <EditableField
                label="Name"
                value={editData.name}
                field="name"
                onChange={handleFieldChange}
                editing={isEditing}
              />
              <EditableField
                label="Type"
                value={editData.animal_type}
                field="animal_type"
                type="select"
                options={ANIMAL_TYPE_OPTIONS}
                onChange={handleFieldChange}
                editing={isEditing}
              />
              <EditableField
                label="Category"
                value={editData.category}
                field="category"
                type="select"
                options={CATEGORY_OPTIONS}
                onChange={handleFieldChange}
                editing={isEditing}
              />
              <EditableField
                label="Breed"
                value={editData.breed}
                field="breed"
                onChange={handleFieldChange}
                placeholder="e.g., Labrador"
                editing={isEditing}
              />
              <EditableField
                label="Color"
                value={editData.color}
                field="color"
                onChange={handleFieldChange}
                placeholder="e.g., Black"
                editing={isEditing}
              />
              <EditableField
                label="Sex"
                value={editData.sex}
                field="sex"
                type="select"
                options={getSexOptions(editData.animal_type)}
                onChange={handleFieldChange}
                editing={isEditing}
              />
              <EditableField
                label="Tag #"
                value={editData.tag_number}
                field="tag_number"
                onChange={handleFieldChange}
                editing={isEditing}
              />
              <EditableField
                label="Microchip"
                value={editData.microchip}
                field="microchip"
                onChange={handleFieldChange}
                editing={isEditing}
              />
              <EditableField
                label="Birth Date"
                value={editData.birth_date}
                field="birth_date"
                type="date"
                onChange={handleFieldChange}
                editing={isEditing}
              />
              <EditableField
                label="Acquired Date"
                value={editData.acquisition_date}
                field="acquisition_date"
                type="date"
                onChange={handleFieldChange}
                editing={isEditing}
              />
              <EditableField
                label="Current Weight (lbs)"
                value={editData.current_weight}
                field="current_weight"
                type="number"
                onChange={handleFieldChange}
                editing={isEditing}
              />
              <LocationSelect
                value={editData.pasture}
                subValue={editData.sub_location}
                onChange={(value) => handleFieldChange('pasture', value)}
                onSubChange={(value) => handleFieldChange('sub_location', value)}
                farmAreas={farmAreas}
                editing={isEditing}
                label="Location"
              />
            </div>

            {/* Notes - Full width */}
            <div className="mt-3">
              <EditableField
                label="Notes"
                value={editData.notes}
                field="notes"
                type="textarea"
                onChange={handleFieldChange}
                placeholder="Any notes about this animal..."
                editing={isEditing}
              />
            </div>

            {/* Special Instructions - Full width */}
            <div className="mt-3">
              <EditableField
                label="Special Instructions (shown in Feed Widget)"
                value={editData.special_instructions}
                field="special_instructions"
                type="textarea"
                onChange={handleFieldChange}
                placeholder="e.g., Give separately, needs soaked feed, check water daily..."
                editing={isEditing}
              />
            </div>
          </div>

          {/* Livestock-specific fields */}
          {isLivestock && (
            <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
              <h4 className="text-sm font-medium text-gray-400 mb-3">Livestock Details</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <EditableField
                  label="Target Weight (lbs)"
                  value={editData.target_weight}
                  field="target_weight"
                  type="number"
                  onChange={handleFieldChange}
                  editing={isEditing}
                />
                <EditableField
                  label="Slaughter Date"
                  value={editData.slaughter_date}
                  field="slaughter_date"
                  type="date"
                  onChange={handleFieldChange}
                  editing={isEditing}
                />
                <EditableField
                  label="Processor"
                  value={editData.processor}
                  field="processor"
                  onChange={handleFieldChange}
                  placeholder="Processor name"
                  editing={isEditing}
                />
                <EditableField
                  label="Pickup Date"
                  value={editData.pickup_date}
                  field="pickup_date"
                  type="date"
                  onChange={handleFieldChange}
                  editing={isEditing}
                />
              </div>
            </div>
          )}

          {/* Care Frequency Settings */}
          <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
            <h4 className="text-sm font-medium text-gray-400 mb-3">Care Frequency (days)</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <EditableField
                label="Worming"
                value={editData.worming_frequency_days}
                field="worming_frequency_days"
                type="number"
                onChange={handleFieldChange}
                placeholder="e.g., 90"
                editing={isEditing}
              />
              <EditableField
                label="Vaccination"
                value={editData.vaccination_frequency_days}
                field="vaccination_frequency_days"
                type="number"
                onChange={handleFieldChange}
                placeholder="e.g., 365"
                editing={isEditing}
              />
              <EditableField
                label="Hoof Trim"
                value={editData.hoof_trim_frequency_days}
                field="hoof_trim_frequency_days"
                type="number"
                onChange={handleFieldChange}
                placeholder="e.g., 60"
                editing={isEditing}
              />
              <EditableField
                label="Dental"
                value={editData.dental_frequency_days}
                field="dental_frequency_days"
                type="number"
                onChange={handleFieldChange}
                placeholder="e.g., 365"
                editing={isEditing}
              />
            </div>
          </div>

          {/* Cold Sensitivity */}
          <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
            <h4 className="text-sm font-medium text-gray-400 mb-3">Cold Sensitivity</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
              <EditableField
                label="Cold Sensitive"
                value={editData.cold_sensitive}
                field="cold_sensitive"
                type="checkbox"
                onChange={handleFieldChange}
                editing={isEditing}
              />
              {editData.cold_sensitive && (
                <>
                  <EditableField
                    label="Min Temp (°F)"
                    value={editData.min_temp}
                    field="min_temp"
                    type="number"
                    onChange={handleFieldChange}
                    editing={isEditing}
                  />
                  <EditableField
                    label="Blanket Below (°F)"
                    value={editData.needs_blanket_below}
                    field="needs_blanket_below"
                    type="number"
                    onChange={handleFieldChange}
                    editing={isEditing}
                  />
                </>
              )}
            </div>
          </div>

          {/* Feeding Info - Multiple Feeds */}
          <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-400">Feeding</h4>
              <button
                onClick={(e) => { e.stopPropagation(); onAddFeed() }}
                className="text-xs px-2 py-1 bg-cyan-700/50 hover:bg-cyan-600 rounded text-white transition-colors flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add Feed
              </button>
            </div>
            {animal.feeds && animal.feeds.length > 0 ? (
              <div className="space-y-2">
                {animal.feeds.map(feed => (
                  <div key={feed.id} className="flex items-center justify-between bg-gray-800 rounded px-3 py-2">
                    <div className="flex-1 flex items-center gap-4 text-sm">
                      <span className="font-medium text-cyan-400">{feed.feed_type}</span>
                      {feed.amount && <span className="text-gray-300">{feed.amount}</span>}
                      {feed.frequency && <span className="text-gray-400">{feed.frequency}</span>}
                      {feed.notes && <span className="text-gray-500 text-xs truncate max-w-[200px]">{feed.notes}</span>}
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); onEditFeed(feed) }}
                        className="p-1 hover:bg-gray-700 rounded transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-3 h-3 text-gray-400 hover:text-white" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onDeleteFeed(feed.id) }}
                        className="p-1 hover:bg-red-900/50 rounded transition-colors"
                        title="Delete"
                      >
                        <X className="w-3 h-3 text-gray-400 hover:text-red-400" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-2">
                No feeds added. Click "Add Feed" to create one.
              </p>
            )}
          </div>

          {/* Dynamic Care Schedules */}
          <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-400">Care Schedule</h4>
              <button
                onClick={(e) => { e.stopPropagation(); onAddCareSchedule() }}
                className="text-xs px-2 py-1 bg-farm-green/50 hover:bg-farm-green rounded text-white transition-colors flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>
            {animal.care_schedules && animal.care_schedules.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {animal.care_schedules.map(schedule => (
                  <DynamicCareCard
                    key={schedule.id}
                    schedule={schedule}
                    onComplete={() => onCompleteCareSchedule(schedule.id)}
                    onEdit={() => onEditCareSchedule(schedule)}
                    onDelete={() => onDeleteCareSchedule(schedule.id)}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">
                No care items scheduled. Click "Add" to create one.
              </p>
            )}
          </div>

          {/* LIVESTOCK: Slaughter & Expenses */}
          {isLivestock && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Slaughter Info */}
              {animal.slaughter_date && (
                <div className="p-3 rounded-lg" style={getUrgencyStyle(slaughterDays)}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium flex items-center gap-2">
                      <Calendar className="w-4 h-4" /> Slaughter Date
                    </span>
                    <span className="font-bold">
                      {slaughterDays <= 0 ? 'Ready!' : `${slaughterDays} days`}
                    </span>
                  </div>
                  <p className="text-sm">{format(safeParseDate(animal.slaughter_date), 'MMMM d, yyyy')}</p>
                  {animal.target_weight && (
                    <p className="text-xs mt-1 opacity-75">Target: {animal.target_weight} lbs</p>
                  )}
                  {animal.processor && (
                    <p className="text-xs mt-1 opacity-75">Processor: {animal.processor}</p>
                  )}
                </div>
              )}

              {/* Expense Summary */}
              <div className="bg-gray-700 p-3 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="font-medium flex items-center gap-2">
                    <DollarSign className="w-4 h-4" /> Total Investment
                  </span>
                  <span className="font-bold text-green-400">
                    ${(animal.total_expenses || 0).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Archive Button */}
              <div className="md:col-span-2">
                <button
                  onClick={(e) => { e.stopPropagation(); onArchive(animal) }}
                  className="w-full px-4 py-2 bg-orange-700 hover:bg-orange-600 text-white rounded-lg flex items-center justify-center gap-2 transition-colors"
                >
                  <Package className="w-4 h-4" />
                  Archive & Record Production
                </button>
              </div>
            </div>
          )}

          {/* Tags */}
          <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
            <h4 className="text-sm font-medium text-gray-400 mb-2">Tags</h4>
            <div className="flex flex-wrap gap-2">
              {Object.entries(ANIMAL_TAGS).map(([key, { label, color }]) => {
                const isActive = animalTags.includes(key)
                return (
                  <button
                    key={key}
                    onClick={(e) => { e.stopPropagation(); onToggleTag(key) }}
                    className={`text-xs px-2 py-1 rounded transition-all ${
                      isActive
                        ? color
                        : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

        </div>
      )}
    </div>
  )
}


// Care Card Component for recurring care schedules
function CareCard({ title, icon, lastDate, nextDate, isOverdue, frequencyDays, onConfirm, onEditDate }) {
  if (!frequencyDays) {
    return (
      <div className="bg-gray-800 p-2 rounded-lg text-center opacity-50">
        <div className="text-lg">{icon}</div>
        <div className="text-xs text-gray-500">{title}</div>
        <div className="text-xs text-gray-600">Not scheduled</div>
      </div>
    )
  }

  const getDaysUntil = (dateStr) => {
    if (!dateStr) return null
    return differenceInDays(safeParseDate(dateStr), new Date())
  }

  const daysUntil = getDaysUntil(nextDate)

  return (
    <div className={`p-2 rounded-lg ${
      isOverdue ? 'bg-red-900/50 border border-red-700' :
      daysUntil !== null && daysUntil <= 7 ? 'bg-yellow-900/30' :
      'bg-gray-800'
    }`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-lg">{icon}</span>
        {isOverdue && (
          <span className="text-xs bg-red-700 text-white px-1.5 py-0.5 rounded">OVERDUE</span>
        )}
      </div>
      <div className="text-xs font-medium">{title}</div>
      <div className="flex items-center gap-1 text-xs text-gray-500">
        <span>Last: {lastDate ? format(safeParseDate(lastDate), 'MMM d') : 'Never'}</span>
        {onEditDate && (
          <button
            onClick={(e) => { e.stopPropagation(); onEditDate() }}
            className="p-0.5 hover:bg-gray-700 rounded"
            title="Edit date"
          >
            <Pencil className="w-3 h-3 text-gray-500 hover:text-white" />
          </button>
        )}
      </div>
      {nextDate && (
        <div className={`text-xs ${isOverdue ? 'text-red-300' : 'text-gray-400'}`}>
          {isOverdue ? 'Was due: ' : 'Due: '}
          {format(safeParseDate(nextDate), 'MMM d')}
        </div>
      )}
      <button
        onClick={(e) => { e.stopPropagation(); onConfirm() }}
        className={`w-full mt-2 px-2 py-1 rounded text-xs flex items-center justify-center gap-1 transition-colors ${
          isOverdue
            ? 'bg-red-700 hover:bg-red-600 text-white'
            : 'bg-farm-green/50 hover:bg-farm-green text-white'
        }`}
      >
        <Check className="w-3 h-3" /> Done
      </button>
    </div>
  )
}


// Dynamic Care Card for flexible care schedules
function DynamicCareCard({ schedule, onComplete, onEdit, onDelete }) {
  const { formatTime } = useSettings()
  const daysUntil = schedule.days_until_due
  const isOverdue = schedule.is_overdue

  return (
    <div className={`p-2 rounded-lg ${
      isOverdue ? 'bg-red-900/50 border border-red-700' :
      daysUntil !== null && daysUntil <= 7 ? 'bg-yellow-900/30' :
      'bg-gray-800'
    }`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium truncate">{schedule.name}</span>
        {isOverdue && (
          <span className="text-xs bg-red-700 text-white px-1.5 py-0.5 rounded">DUE</span>
        )}
      </div>
      <div className="text-xs text-gray-500">
        {schedule.last_performed ? (
          <span>Last: {format(safeParseDate(schedule.last_performed), 'MMM d')}</span>
        ) : (
          <span>Never done</span>
        )}
      </div>
      {schedule.due_date && (
        <div className={`text-xs ${isOverdue ? 'text-red-300' : 'text-gray-400'}`}>
          {isOverdue ? 'Was due: ' : 'Due: '}
          {format(safeParseDate(schedule.due_date), 'MMM d')}
          {schedule.due_time && ` @ ${formatTime(schedule.due_time)}`}
          {daysUntil !== null && !isOverdue && ` (${daysUntil}d)`}
        </div>
      )}
      {schedule.frequency_days && (
        <div className="text-xs text-gray-600">
          Every {schedule.frequency_days}d
        </div>
      )}
      <div className="flex gap-1 mt-2">
        <button
          onClick={(e) => { e.stopPropagation(); onComplete() }}
          className={`flex-1 px-2 py-1 rounded text-xs flex items-center justify-center gap-1 transition-colors ${
            isOverdue
              ? 'bg-red-700 hover:bg-red-600 text-white'
              : 'bg-farm-green/50 hover:bg-farm-green text-white'
          }`}
          title="Mark as done"
        >
          <Check className="w-3 h-3" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onEdit() }}
          className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs transition-colors"
          title="Edit"
        >
          <Pencil className="w-3 h-3" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="px-2 py-1 bg-red-900/50 hover:bg-red-800 rounded text-xs text-red-300 transition-colors"
          title="Delete"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}


// Care Schedule Form Modal
function CareScheduleFormModal({ schedule, animalName, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: schedule?.name || '',
    frequency_days: schedule?.frequency_days || '',
    last_performed: schedule?.last_performed || '',
    manual_due_date: schedule?.manual_due_date || '',
    due_time: schedule?.due_time || '',
    notes: schedule?.notes || '',
    reminder_alerts: schedule?.reminder_alerts || null,
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const data = {
        name: formData.name,
        frequency_days: formData.frequency_days ? parseInt(formData.frequency_days) : null,
        last_performed: formData.last_performed || null,
        manual_due_date: formData.manual_due_date || null,
        due_time: formData.due_time || null,
        notes: formData.notes || null,
        reminder_alerts: formData.reminder_alerts || null,
      }
      await onSave(data)
    } catch (error) {
      console.error('Failed to save care schedule:', error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {schedule ? 'Edit Care Item' : 'Add Care Item'} {animalName && `for ${animalName}`}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Care Item Name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Hoof Trim, Worming, Vaccinations"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Frequency (days)</label>
            <input
              type="number"
              value={formData.frequency_days}
              onChange={(e) => setFormData({ ...formData, frequency_days: e.target.value })}
              placeholder="e.g., 60 for every 2 months"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
            />
            <p className="text-xs text-gray-500 mt-1">Optional - leave empty for manual scheduling</p>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Last Performed</label>
            <input
              type="date"
              value={formData.last_performed}
              onChange={(e) => setFormData({ ...formData, last_performed: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Manual Due Date</label>
              <input
                type="date"
                value={formData.manual_due_date}
                onChange={(e) => setFormData({ ...formData, manual_due_date: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Time Due</label>
              <input
                type="time"
                value={formData.due_time}
                onChange={(e) => setFormData({ ...formData, due_time: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
              />
            </div>
          </div>
          <p className="text-xs text-gray-500 -mt-2">Set specific date/time for this care task</p>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              placeholder="Optional notes about this care item"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
            />
          </div>

          {/* Alerts Section */}
          <div className="space-y-2 pt-3 border-t border-gray-700">
            <label className="block text-sm text-gray-400 mb-2">Alerts (optional)</label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 0, label: 'At time' },
                { value: 5, label: '5 min' },
                { value: 10, label: '10 min' },
                { value: 15, label: '15 min' },
                { value: 30, label: '30 min' },
                { value: 60, label: '1 hr' },
                { value: 120, label: '2 hrs' },
                { value: 1440, label: '1 day' },
                { value: 2880, label: '2 days' },
                { value: 10080, label: '1 week' },
              ].map(opt => {
                const isSelected = (formData.reminder_alerts || []).includes(opt.value)
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      const current = formData.reminder_alerts || []
                      const newAlerts = isSelected
                        ? current.filter(v => v !== opt.value)
                        : [...current, opt.value].sort((a, b) => b - a)
                      setFormData({ ...formData, reminder_alerts: newAlerts.length > 0 ? newAlerts : null })
                    }}
                    className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                      isSelected
                        ? 'bg-cyan-600/30 border border-cyan-500 text-cyan-300'
                        : 'bg-gray-700/50 border border-gray-600 text-gray-400 hover:border-gray-500'
                    }`}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-farm-green hover:bg-farm-green-light text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : (schedule ? 'Update' : 'Add Care Item')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}


// Bulk Care Schedule Modal - add same care item to multiple animals
function BulkCareScheduleModal({ animals, onClose, onSave }) {
  const [selectedAnimals, setSelectedAnimals] = useState([])
  const [formData, setFormData] = useState({
    name: '',
    frequency_days: '',
    due_time: '',
    is_one_time: false,
    last_performed: '',
    manual_due_date: '',
    notes: '',
    reminder_alerts: null,
  })
  const [saving, setSaving] = useState(false)
  const [filterType, setFilterType] = useState('all') // all, pet, livestock, or animal_type

  // Group animals by type for easier selection
  const animalsByType = animals.reduce((acc, animal) => {
    const type = animal.animal_type
    if (!acc[type]) acc[type] = []
    acc[type].push(animal)
    return acc
  }, {})

  const toggleAnimal = (id) => {
    setSelectedAnimals(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    )
  }

  const selectAllOfType = (type) => {
    const ids = animalsByType[type].map(a => a.id)
    const allSelected = ids.every(id => selectedAnimals.includes(id))
    if (allSelected) {
      setSelectedAnimals(prev => prev.filter(id => !ids.includes(id)))
    } else {
      setSelectedAnimals(prev => [...new Set([...prev, ...ids])])
    }
  }

  const selectAll = () => {
    if (selectedAnimals.length === animals.length) {
      setSelectedAnimals([])
    } else {
      setSelectedAnimals(animals.map(a => a.id))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (selectedAnimals.length === 0) {
      alert('Please select at least one animal')
      return
    }
    setSaving(true)
    try {
      const data = {
        animal_ids: selectedAnimals,
        name: formData.name,
        frequency_days: formData.is_one_time ? null : (formData.frequency_days ? parseInt(formData.frequency_days) : null),
        due_time: formData.due_time || null,
        last_performed: formData.last_performed || null,
        manual_due_date: formData.manual_due_date || null,
        notes: formData.notes || null,
        reminder_alerts: formData.reminder_alerts || null,
      }
      await onSave(data)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-700 flex items-center justify-between flex-shrink-0">
          <h2 className="text-lg font-semibold">Add Care Item to Multiple Animals</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col">
          <div className="p-4 space-y-4 flex-shrink-0">
            {/* Care Item Details */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Care Item Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Worming, Nail Trim"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Frequency (days)</label>
                <input
                  type="number"
                  value={formData.frequency_days}
                  onChange={(e) => setFormData({ ...formData, frequency_days: e.target.value })}
                  placeholder="e.g., 60"
                  disabled={formData.is_one_time}
                  className={`w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green ${formData.is_one_time ? 'opacity-50 cursor-not-allowed' : ''}`}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Due Time (optional)</label>
                <input
                  type="time"
                  value={formData.due_time}
                  onChange={(e) => setFormData({ ...formData, due_time: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
              <div className="flex items-center">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-400 mt-5">
                  <input
                    type="checkbox"
                    checked={formData.is_one_time}
                    onChange={(e) => setFormData({ ...formData, is_one_time: e.target.checked })}
                    className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-farm-green focus:ring-farm-green"
                  />
                  One-time only
                  <span className="text-xs text-gray-500">(no recurring schedule)</span>
                </label>
              </div>
            </div>

            {/* Alerts Section */}
            <div className="space-y-2 pt-3 border-t border-gray-700">
              <label className="block text-sm text-gray-400 mb-2">Alerts (optional)</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 0, label: 'At time' },
                  { value: 5, label: '5 min' },
                  { value: 10, label: '10 min' },
                  { value: 15, label: '15 min' },
                  { value: 30, label: '30 min' },
                  { value: 60, label: '1 hr' },
                  { value: 120, label: '2 hrs' },
                  { value: 1440, label: '1 day' },
                  { value: 2880, label: '2 days' },
                  { value: 10080, label: '1 week' },
                ].map(opt => {
                  const isSelected = (formData.reminder_alerts || []).includes(opt.value)
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        const current = formData.reminder_alerts || []
                        const newAlerts = isSelected
                          ? current.filter(v => v !== opt.value)
                          : [...current, opt.value].sort((a, b) => b - a)
                        setFormData({ ...formData, reminder_alerts: newAlerts.length > 0 ? newAlerts : null })
                      }}
                      className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                        isSelected
                          ? 'bg-cyan-600/30 border border-cyan-500 text-cyan-300'
                          : 'bg-gray-700/50 border border-gray-600 text-gray-400 hover:border-gray-500'
                      }`}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Animal Selection Header */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">
                Select Animals ({selectedAnimals.length} selected)
              </span>
              <button
                type="button"
                onClick={selectAll}
                className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded"
              >
                {selectedAnimals.length === animals.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
          </div>

          {/* Scrollable Animal List */}
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <div className="space-y-3">
              {Object.entries(animalsByType).map(([type, typeAnimals]) => (
                <div key={type} className="bg-gray-700/30 rounded-lg p-2">
                  <button
                    type="button"
                    onClick={() => selectAllOfType(type)}
                    className="flex items-center gap-2 w-full text-left mb-2 hover:bg-gray-700/50 rounded px-2 py-1"
                  >
                    <input
                      type="checkbox"
                      checked={typeAnimals.every(a => selectedAnimals.includes(a.id))}
                      onChange={() => {}}
                      className="rounded border-gray-600 bg-gray-700 text-farm-green"
                    />
                    <span className="font-medium capitalize">{type}</span>
                    <span className="text-xs text-gray-500">({typeAnimals.length})</span>
                  </button>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 ml-6">
                    {typeAnimals.map(animal => (
                      <label
                        key={animal.id}
                        className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-sm ${
                          selectedAnimals.includes(animal.id)
                            ? 'bg-farm-green/20 text-white'
                            : 'hover:bg-gray-700/50 text-gray-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedAnimals.includes(animal.id)}
                          onChange={() => toggleAnimal(animal.id)}
                          className="rounded border-gray-600 bg-gray-700 text-farm-green"
                        />
                        <span className="truncate">{animal.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Submit */}
          <div className="flex gap-3 p-4 border-t border-gray-700 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || selectedAnimals.length === 0}
              className="flex-1 px-4 py-2 bg-farm-green hover:bg-farm-green-light text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Creating...' : `Add to ${selectedAnimals.length} Animals`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}


// Inline Feeds Section for AnimalFormModal
function FeedsSection({ animal, onFeedsChange }) {
  const [feeds, setFeeds] = useState(animal?.feeds || [])
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingFeedId, setEditingFeedId] = useState(null)
  const [formData, setFormData] = useState({ feed_type: '', amount: '', frequency: '', notes: '' })
  const [saving, setSaving] = useState(false)

  const resetForm = () => {
    setFormData({ feed_type: '', amount: '', frequency: '', notes: '' })
    setShowAddForm(false)
    setEditingFeedId(null)
  }

  const handleAdd = async () => {
    if (!formData.feed_type.trim()) return
    setSaving(true)
    try {
      const response = await createAnimalFeed(animal.id, formData)
      setFeeds([...feeds, response.data])
      resetForm()
      onFeedsChange()
    } catch (error) {
      console.error('Failed to add feed:', error)
      alert('Failed to add feed')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = async () => {
    if (!formData.feed_type.trim()) return
    setSaving(true)
    try {
      await updateAnimalFeed(animal.id, editingFeedId, formData)
      setFeeds(feeds.map(f => f.id === editingFeedId ? { ...f, ...formData } : f))
      resetForm()
      onFeedsChange()
    } catch (error) {
      console.error('Failed to update feed:', error)
      alert('Failed to update feed')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (feedId) => {
    if (!confirm('Delete this feed entry?')) return
    try {
      await deleteAnimalFeed(animal.id, feedId)
      setFeeds(feeds.filter(f => f.id !== feedId))
      onFeedsChange()
    } catch (error) {
      console.error('Failed to delete feed:', error)
      alert('Failed to delete feed')
    }
  }

  const startEdit = (feed) => {
    setFormData({
      feed_type: feed.feed_type || '',
      amount: feed.amount || '',
      frequency: feed.frequency || '',
      notes: feed.notes || '',
    })
    setEditingFeedId(feed.id)
    setShowAddForm(false)
  }

  const startAdd = () => {
    setFormData({ feed_type: '', amount: '', frequency: '', notes: '' })
    setShowAddForm(true)
    setEditingFeedId(null)
  }

  return (
    <div className="border-t border-gray-700 pt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-cyan-400">Feeds</h3>
        {!showAddForm && !editingFeedId && (
          <button
            type="button"
            onClick={startAdd}
            className="text-xs px-2 py-1 bg-cyan-700/50 hover:bg-cyan-600 rounded text-white transition-colors flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> Add Feed
          </button>
        )}
      </div>

      {/* Existing feeds list */}
      {feeds.length > 0 && (
        <div className="space-y-2 mb-3">
          {feeds.map(feed => (
            <div key={feed.id} className={`flex items-center justify-between bg-gray-700/50 rounded px-3 py-2 ${editingFeedId === feed.id ? 'ring-2 ring-cyan-500' : ''}`}>
              {editingFeedId === feed.id ? (
                <div className="flex-1 text-sm text-cyan-300">Editing...</div>
              ) : (
                <div className="flex-1 flex items-center gap-3 text-sm">
                  <span className="font-medium text-cyan-400">{feed.feed_type}</span>
                  {feed.amount && <span className="text-gray-300">{feed.amount}</span>}
                  {feed.frequency && <span className="text-gray-400">{feed.frequency}</span>}
                </div>
              )}
              {editingFeedId !== feed.id && (
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => startEdit(feed)}
                    className="p-1 hover:bg-gray-600 rounded transition-colors"
                    title="Edit"
                  >
                    <Pencil className="w-3 h-3 text-gray-400 hover:text-white" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(feed.id)}
                    className="p-1 hover:bg-red-900/50 rounded transition-colors"
                    title="Delete"
                  >
                    <X className="w-3 h-3 text-gray-400 hover:text-red-400" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit form */}
      {(showAddForm || editingFeedId) && (
        <div className="bg-gray-700/30 rounded-lg p-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Feed Type *</label>
              <input
                type="text"
                value={formData.feed_type}
                onChange={(e) => setFormData({ ...formData, feed_type: e.target.value })}
                placeholder="e.g., Grain, Hay"
                className="w-full px-2 py-1.5 text-sm bg-gray-700 border border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Amount</label>
              <input
                type="text"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="e.g., 2 cups"
                className="w-full px-2 py-1.5 text-sm bg-gray-700 border border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Frequency</label>
            <select
              value={formData.frequency}
              onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
              className="w-full px-2 py-1.5 text-sm bg-gray-700 border border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500"
            >
              <option value="">-</option>
              <option value="Once daily">Once daily</option>
              <option value="Twice daily">Twice daily</option>
              <option value="3 times daily">3 times daily</option>
              <option value="Constant access">Constant access</option>
              <option value="As needed">As needed</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={resetForm}
              className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 rounded text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={editingFeedId ? handleEdit : handleAdd}
              disabled={saving || !formData.feed_type.trim()}
              className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 rounded text-sm transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : (editingFeedId ? 'Update Feed' : 'Add Feed')}
            </button>
          </div>
        </div>
      )}

      {feeds.length === 0 && !showAddForm && (
        <p className="text-xs text-gray-500 text-center py-2">
          No feeds added. Click "Add Feed" to create one.
        </p>
      )}
    </div>
  )
}


// Animal Form Modal
function AnimalFormModal({ animal, farmAreas = [], onClose, onSave, isDuplicate = false }) {
  const [formData, setFormData] = useState({
    name: isDuplicate && animal?.name ? `${animal.name} (Copy)` : (animal?.name || ''),
    animal_type: animal?.animal_type || 'dog',
    category: animal?.category || 'pet',
    breed: animal?.breed || '',
    color: animal?.color || '',
    tag_number: isDuplicate ? '' : (animal?.tag_number || ''), // Clear tag number for duplicates
    sex: animal?.sex || '',
    birth_date: animal?.birth_date || '',
    acquisition_date: animal?.acquisition_date || '',
    current_weight: animal?.current_weight || '',
    pasture: animal?.pasture || '',
    sub_location: animal?.sub_location || '',
    farm_area_id: animal?.farm_area_id || '',
    notes: animal?.notes || '',
    special_instructions: animal?.special_instructions || '',
    // Livestock
    target_weight: animal?.target_weight || '',
    slaughter_date: animal?.slaughter_date || '',
    processor: animal?.processor || '',
    pickup_date: animal?.pickup_date || '',
    // Pet care frequencies (in days)
    worming_frequency_days: animal?.worming_frequency_days || '',
    vaccination_frequency_days: animal?.vaccination_frequency_days || '',
    hoof_trim_frequency_days: animal?.hoof_trim_frequency_days || '',
    dental_frequency_days: animal?.dental_frequency_days || '',
    // Cold tolerance
    cold_sensitive: animal?.cold_sensitive || false,
    min_temp: animal?.min_temp || '',
    needs_blanket_below: animal?.needs_blanket_below || '',
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const data = {
        ...formData,
        current_weight: formData.current_weight ? parseFloat(formData.current_weight) : null,
        target_weight: formData.target_weight ? parseFloat(formData.target_weight) : null,
        worming_frequency_days: formData.worming_frequency_days ? parseInt(formData.worming_frequency_days) : null,
        vaccination_frequency_days: formData.vaccination_frequency_days ? parseInt(formData.vaccination_frequency_days) : null,
        hoof_trim_frequency_days: formData.hoof_trim_frequency_days ? parseInt(formData.hoof_trim_frequency_days) : null,
        dental_frequency_days: formData.dental_frequency_days ? parseInt(formData.dental_frequency_days) : null,
        min_temp: formData.min_temp ? parseFloat(formData.min_temp) : null,
        needs_blanket_below: formData.needs_blanket_below ? parseFloat(formData.needs_blanket_below) : null,
        birth_date: formData.birth_date || null,
        acquisition_date: formData.acquisition_date || null,
        slaughter_date: formData.slaughter_date || null,
        pickup_date: formData.pickup_date || null,
        farm_area_id: formData.farm_area_id ? parseInt(formData.farm_area_id) : null,
      }

      if (animal && !isDuplicate) {
        await updateAnimal(animal.id, data)
      } else {
        await createAnimal(data)
      }
      onSave()
    } catch (error) {
      console.error('Failed to save animal:', error)
      alert('Failed to save animal')
    } finally {
      setSaving(false)
    }
  }

  const isPet = formData.category === 'pet'
  const isLivestock = formData.category === 'livestock'

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gray-800 p-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-xl font-semibold">{isDuplicate ? 'Duplicate Animal' : (animal ? 'Edit Animal' : 'Add New Animal')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Category Selection */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Category *</label>
            <div className="flex gap-4">
              <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                isPet ? 'bg-pink-900/30 border-pink-500' : 'bg-gray-700 border-gray-600 hover:border-gray-500'
              }`}>
                <input
                  type="radio"
                  name="category"
                  value="pet"
                  checked={isPet}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="sr-only"
                />
                <Heart className="w-5 h-5" />
                <span>Pet</span>
              </label>
              <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                isLivestock ? 'bg-amber-900/30 border-amber-500' : 'bg-gray-700 border-gray-600 hover:border-gray-500'
              }`}>
                <input
                  type="radio"
                  name="category"
                  value="livestock"
                  checked={isLivestock}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="sr-only"
                />
                <Beef className="w-5 h-5" />
                <span>Livestock</span>
              </label>
            </div>
          </div>

          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Type *</label>
              <select
                value={formData.animal_type}
                onChange={(e) => setFormData({ ...formData, animal_type: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
              >
                <optgroup label="Common Pets">
                  <option value="dog">Dog</option>
                  <option value="cat">Cat</option>
                  <option value="horse">Horse</option>
                  <option value="mini_horse">Mini Horse</option>
                  <option value="donkey">Donkey</option>
                  <option value="llama">Llama</option>
                  <option value="alpaca">Alpaca</option>
                </optgroup>
                <optgroup label="Livestock">
                  <option value="cattle">Cattle</option>
                  <option value="goat">Goat</option>
                  <option value="sheep">Sheep</option>
                  <option value="pig">Pig</option>
                  <option value="chicken">Chicken</option>
                  <option value="duck">Duck</option>
                  <option value="turkey">Turkey</option>
                  <option value="rabbit">Rabbit</option>
                </optgroup>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Breed</label>
              <input
                type="text"
                value={formData.breed}
                onChange={(e) => setFormData({ ...formData, breed: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Color</label>
              <input
                type="text"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                placeholder="e.g., Bay, Black, Sorrel, Brindle"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Sex</label>
              <select
                value={formData.sex}
                onChange={(e) => setFormData({ ...formData, sex: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
              >
                {getSexOptions(formData.animal_type).map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Birth Date</label>
              <input
                type="date"
                value={formData.birth_date}
                onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Current Weight (lbs)</label>
              <input
                type="number"
                step="0.1"
                value={formData.current_weight}
                onChange={(e) => setFormData({ ...formData, current_weight: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
              />
            </div>
            <div className="col-span-2">
              <LocationSelect
                value={formData.pasture}
                subValue={formData.sub_location}
                onChange={(value) => setFormData({ ...formData, pasture: value })}
                onSubChange={(value) => setFormData({ ...formData, sub_location: value })}
                farmAreas={farmAreas}
                editing={true}
                label="Location"
              />
            </div>
          </div>

          {/* Feeds Management - Only for existing animals (editing mode) */}
          {animal && (
            <FeedsSection
              animal={animal}
              onFeedsChange={async () => {
                // This will refresh when modal closes via onSave
              }}
            />
          )}

          {/* Livestock-specific fields */}
          {isLivestock && (
            <div className="border-t border-gray-700 pt-4">
              <h3 className="text-sm font-medium text-amber-400 mb-3">Livestock Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Slaughter Date</label>
                  <input
                    type="date"
                    value={formData.slaughter_date}
                    onChange={(e) => setFormData({ ...formData, slaughter_date: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Target Weight (lbs)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.target_weight}
                    onChange={(e) => setFormData({ ...formData, target_weight: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Processor</label>
                  <input
                    type="text"
                    value={formData.processor}
                    onChange={(e) => setFormData({ ...formData, processor: e.target.value })}
                    placeholder="Slaughterhouse or processor name"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Pickup Date</label>
                  <input
                    type="date"
                    value={formData.pickup_date}
                    onChange={(e) => setFormData({ ...formData, pickup_date: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Pet-specific fields */}
          {isPet && (
            <div className="border-t border-gray-700 pt-4">
              <h3 className="text-sm font-medium text-pink-400 mb-3">Care Schedule (frequency in days)</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Worming</label>
                  <input
                    type="number"
                    value={formData.worming_frequency_days}
                    onChange={(e) => setFormData({ ...formData, worming_frequency_days: e.target.value })}
                    placeholder="e.g., 60"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Vaccination</label>
                  <input
                    type="number"
                    value={formData.vaccination_frequency_days}
                    onChange={(e) => setFormData({ ...formData, vaccination_frequency_days: e.target.value })}
                    placeholder="e.g., 365"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Hoof Trim</label>
                  <input
                    type="number"
                    value={formData.hoof_trim_frequency_days}
                    onChange={(e) => setFormData({ ...formData, hoof_trim_frequency_days: e.target.value })}
                    placeholder="e.g., 42"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Dental</label>
                  <input
                    type="number"
                    value={formData.dental_frequency_days}
                    onChange={(e) => setFormData({ ...formData, dental_frequency_days: e.target.value })}
                    placeholder="e.g., 365"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
            />
          </div>

          {/* Special Instructions */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Special Instructions (shown in Feed Widget)</label>
            <textarea
              value={formData.special_instructions}
              onChange={(e) => setFormData({ ...formData, special_instructions: e.target.value })}
              rows={2}
              placeholder="e.g., Give separately, needs soaked feed, check water daily..."
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
            />
          </div>

          {/* Cold Tolerance */}
          <div className="border-t border-gray-700 pt-4">
            <h3 className="text-sm font-medium text-cyan-400 mb-3 flex items-center gap-2">
              ❄️ Cold Tolerance
            </h3>
            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.cold_sensitive}
                  onChange={(e) => setFormData({ ...formData, cold_sensitive: e.target.checked })}
                  className="w-5 h-5 rounded border-gray-600 bg-gray-700 text-farm-green focus:ring-farm-green"
                />
                <span className="text-gray-300">Cold sensitive animal (needs protection in cold weather)</span>
              </label>

              {formData.cold_sensitive && (
                <div className="grid grid-cols-2 gap-4 ml-8">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Min Comfortable Temp (°F)</label>
                    <input
                      type="number"
                      step="1"
                      value={formData.min_temp}
                      onChange={(e) => setFormData({ ...formData, min_temp: e.target.value })}
                      placeholder="e.g., 40"
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                    />
                    <p className="text-xs text-gray-500 mt-1">Below this temp, provide shelter</p>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Needs Blanket Below (°F)</label>
                    <input
                      type="number"
                      step="1"
                      value={formData.needs_blanket_below}
                      onChange={(e) => setFormData({ ...formData, needs_blanket_below: e.target.value })}
                      placeholder="e.g., 35"
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                    />
                    <p className="text-xs text-gray-500 mt-1">For horses and animals that need blankets</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-farm-green hover:bg-farm-green-light text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : (isDuplicate ? 'Create Copy' : (animal ? 'Update Animal' : 'Add Animal'))}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}


// Expense Form Modal - supports single animal or split across multiple
function ExpenseFormModal({ animalId, animalName, animals, onClose, onSave, onSplitSave }) {
  const [formData, setFormData] = useState(() => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return {
      expense_type: 'purchase',
      description: '',
      amount: '',
      expense_date: `${year}-${month}-${day}`,
      vendor: '',
      notes: '',
    }
  })
  const [saving, setSaving] = useState(false)
  // Split allocations: [{animalId, mode: 'percent'|'dollar', value: ''}]
  // Note: The initial animal (animalId) is NOT in this array - they get the remainder
  const [splitAllocations, setSplitAllocations] = useState([])

  // Calculate allocated amounts for other animals
  const totalAmount = parseFloat(formData.amount) || 0
  const allocatedAmounts = splitAllocations.map(alloc => {
    if (alloc.mode === 'percent') {
      return (totalAmount * (parseFloat(alloc.value) || 0)) / 100
    }
    return parseFloat(alloc.value) || 0
  })
  const totalAllocated = allocatedAmounts.reduce((sum, amt) => sum + amt, 0)
  // Initial animal gets the remainder (can be 100% if no splits, or whatever is left)
  const initialAnimalAmount = Math.max(0, totalAmount - totalAllocated)
  const initialAnimalPercent = totalAmount > 0 ? (initialAnimalAmount / totalAmount * 100) : 100

  // Splits are valid if initial animal gets a non-negative amount (can't allocate more than 100%)
  const splitsValid = initialAnimalAmount >= -0.01 // Small tolerance for floating point

  const addAnimalSplit = () => {
    // Find an animal not already selected
    const usedIds = [animalId, ...splitAllocations.map(a => a.animalId)]
    const availableAnimals = animals?.filter(a => !usedIds.includes(a.id)) || []
    if (availableAnimals.length === 0) return

    setSplitAllocations([...splitAllocations, {
      animalId: availableAnimals[0].id,
      mode: 'percent',
      value: ''
    }])
  }

  const updateSplitAllocation = (index, field, value) => {
    setSplitAllocations(splitAllocations.map((alloc, i) =>
      i === index ? { ...alloc, [field]: value } : alloc
    ))
  }

  const removeSplitAllocation = (index) => {
    setSplitAllocations(splitAllocations.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!splitsValid || !totalAmount) return

    setSaving(true)
    try {
      if (splitAllocations.length === 0) {
        // Single animal expense - use original save
        await onSave({
          ...formData,
          amount: parseFloat(formData.amount),
        })
      } else {
        // Multi-animal split expense
        // Build splits array: initial animal gets remaining, others get their allocated amounts
        const splits = []

        // Add each split allocation (other animals)
        splitAllocations.forEach((alloc, idx) => {
          if (allocatedAmounts[idx] > 0) {
            splits.push({
              animal_id: alloc.animalId,
              amount: allocatedAmounts[idx]
            })
          }
        })

        // Add initial animal with remaining amount
        if (initialAnimalAmount > 0) {
          splits.push({
            animal_id: animalId,
            amount: initialAnimalAmount
          })
        }

        await onSplitSave({
          expense_type: formData.expense_type,
          description: formData.description,
          total_amount: totalAmount,
          expense_date: formData.expense_date,
          vendor: formData.vendor,
          notes: formData.notes,
          splits: splits,
        })
      }
    } catch (error) {
      console.error('Failed to save expense:', error)
    } finally {
      setSaving(false)
    }
  }

  // Get animals available for selection (not already used)
  const getAvailableAnimals = (currentAllocationId) => {
    const usedIds = [animalId, ...splitAllocations.filter(a => a.animalId !== currentAllocationId).map(a => a.animalId)]
    return animals?.filter(a => !usedIds.includes(a.id)) || []
  }

  const canAddAnimal = animals && animals.length > splitAllocations.length + 1

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Add Expense for {animalName}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Type *</label>
            <select
              value={formData.expense_type}
              onChange={(e) => setFormData({ ...formData, expense_type: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
            >
              <option value="purchase">Purchase Price</option>
              <option value="feed">Feed</option>
              <option value="medicine">Medicine</option>
              <option value="vet">Vet Visit</option>
              <option value="equipment">Equipment</option>
              <option value="farrier">Farrier</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Total Amount ($) *</label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Date</label>
              <input
                type="date"
                value={formData.expense_date}
                onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Description</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="e.g., 50lb bag of feed"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Vendor</label>
            <input
              type="text"
              value={formData.vendor}
              onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
              placeholder="e.g., Tractor Supply"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
            />
          </div>

          {/* Split Across Animals Section */}
          {animals && animals.length > 1 && (
            <div className="border-t border-gray-700 pt-4">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm text-gray-400">Split Across Animals</label>
                {canAddAnimal && (
                  <button
                    type="button"
                    onClick={addAnimalSplit}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-cyan-700 hover:bg-cyan-600 rounded transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    Add Animal
                  </button>
                )}
              </div>

              {/* Initial animal - always shown, gets remainder */}
              <div className="bg-cyan-900/30 border border-cyan-700/50 rounded-lg p-3 mb-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-cyan-300">{animalName}</span>
                  <div className="text-right">
                    <div className="text-lg font-bold text-cyan-300">
                      {totalAmount > 0 ? `$${initialAnimalAmount.toFixed(2)}` : '--'}
                    </div>
                    <div className="text-xs text-cyan-400">
                      {splitAllocations.length > 0
                        ? `${initialAnimalPercent.toFixed(0)}% (remainder)`
                        : '100%'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Other animals to split with */}
              {splitAllocations.length > 0 && (
                <div className="space-y-2 mb-3">
                  {splitAllocations.map((alloc, index) => {
                    const animal = animals.find(a => a.id === alloc.animalId)
                    const allocPercent = totalAmount > 0 ? (allocatedAmounts[index] / totalAmount * 100) : 0
                    return (
                      <div key={index} className="flex items-center gap-2 bg-gray-700/50 rounded-lg p-2">
                        <select
                          value={alloc.animalId}
                          onChange={(e) => updateSplitAllocation(index, 'animalId', parseInt(e.target.value))}
                          className="flex-1 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        >
                          {getAvailableAnimals(alloc.animalId).map(a => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                          ))}
                          {animal && <option value={animal.id}>{animal.name}</option>}
                        </select>
                        <select
                          value={alloc.mode}
                          onChange={(e) => updateSplitAllocation(index, 'mode', e.target.value)}
                          className="w-14 px-1 py-1 bg-gray-700 border border-gray-600 rounded text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        >
                          <option value="percent">%</option>
                          <option value="dollar">$</option>
                        </select>
                        <input
                          type="number"
                          step={alloc.mode === 'percent' ? '1' : '0.01'}
                          value={alloc.value}
                          onChange={(e) => updateSplitAllocation(index, 'value', e.target.value)}
                          placeholder={alloc.mode === 'percent' ? '50' : '25.00'}
                          className="w-20 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        />
                        <div className="w-16 text-right text-xs text-gray-400">
                          {totalAmount > 0 && `$${allocatedAmounts[index].toFixed(2)}`}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeSplitAllocation(index)}
                          className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Warning if over-allocated */}
              {!splitsValid && totalAmount > 0 && (
                <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-2 text-sm text-red-300">
                  Total allocations exceed expense amount
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !totalAmount || !splitsValid}
              className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Add Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}


// Split Expense Form Modal - for splitting expenses across multiple animals
function SplitExpenseFormModal({ animals, onClose, onSave }) {
  const [formData, setFormData] = useState(() => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return {
      expense_type: 'feed',
      description: '',
      total_amount: '',
      expense_date: `${year}-${month}-${day}`,
      vendor: '',
      notes: '',
    }
  })
  const [selectedAnimals, setSelectedAnimals] = useState([]) // [{id, name, amount, inputMode}]
  const [splitMode, setSplitMode] = useState('equal') // 'equal' or 'custom'
  const [inputMode, setInputMode] = useState('dollars') // 'dollars' or 'percent' for custom mode
  const [saving, setSaving] = useState(false)

  // Update split amounts when total or animals change
  const updateSplits = (newTotal, newAnimals, mode) => {
    if (mode === 'equal' && newAnimals.length > 0 && newTotal) {
      const equalAmount = parseFloat(newTotal) / newAnimals.length
      setSelectedAnimals(newAnimals.map(a => ({ ...a, amount: equalAmount.toFixed(2) })))
    }
  }

  const toggleAnimal = (animal) => {
    const exists = selectedAnimals.find(a => a.id === animal.id)
    let newAnimals
    if (exists) {
      newAnimals = selectedAnimals.filter(a => a.id !== animal.id)
    } else {
      newAnimals = [...selectedAnimals, { id: animal.id, name: animal.name, amount: '' }]
    }
    setSelectedAnimals(newAnimals)
    if (splitMode === 'equal' && formData.total_amount) {
      updateSplits(formData.total_amount, newAnimals, 'equal')
    }
  }

  const updateAnimalAmount = (animalId, amount) => {
    setSelectedAnimals(selectedAnimals.map(a =>
      a.id === animalId ? { ...a, amount } : a
    ))
  }

  const handleTotalChange = (newTotal) => {
    setFormData({ ...formData, total_amount: newTotal })
    if (splitMode === 'equal') {
      updateSplits(newTotal, selectedAnimals, 'equal')
    }
  }

  const handleSplitModeChange = (mode) => {
    setSplitMode(mode)
    if (mode === 'equal' && formData.total_amount) {
      updateSplits(formData.total_amount, selectedAnimals, 'equal')
    }
    // Reset to dollars when switching to custom
    if (mode === 'custom') {
      setInputMode('dollars')
      // Clear amounts when switching modes
      setSelectedAnimals(selectedAnimals.map(a => ({ ...a, amount: '' })))
    }
  }

  const handleInputModeChange = (mode) => {
    setInputMode(mode)
    // Clear all amounts when switching input modes
    setSelectedAnimals(selectedAnimals.map(a => ({ ...a, amount: '' })))
  }

  // Calculate actual dollar amounts based on input mode
  const getActualAmount = (animal) => {
    const val = parseFloat(animal.amount) || 0
    if (inputMode === 'percent') {
      return (val / 100) * (parseFloat(formData.total_amount) || 0)
    }
    return val
  }

  const splitTotal = selectedAnimals.reduce((sum, a) => sum + getActualAmount(a), 0)
  const remaining = (parseFloat(formData.total_amount) || 0) - splitTotal
  const percentTotal = inputMode === 'percent'
    ? selectedAnimals.reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0)
    : null
  const isValid = selectedAnimals.length >= 1 &&
    formData.total_amount &&
    Math.abs(remaining) < 0.01 &&
    selectedAnimals.every(a => parseFloat(a.amount) > 0) &&
    // For percent mode, also ensure percentages add to ~100%
    (inputMode !== 'percent' || (percentTotal !== null && Math.abs(percentTotal - 100) < 0.1))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!isValid) return

    setSaving(true)
    try {
      await onSave({
        expense_type: formData.expense_type,
        description: formData.description,
        total_amount: parseFloat(formData.total_amount),
        expense_date: formData.expense_date,
        vendor: formData.vendor,
        notes: formData.notes,
        splits: selectedAnimals.map(a => ({
          animal_id: a.id,
          amount: getActualAmount(a),
        })),
      })
    } catch (error) {
      console.error('Failed to save split expense:', error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Split Expense Across Animals</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Expense Details */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Type *</label>
              <select
                value={formData.expense_type}
                onChange={(e) => setFormData({ ...formData, expense_type: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="feed">Feed</option>
                <option value="medicine">Medicine</option>
                <option value="vet">Vet Visit</option>
                <option value="equipment">Equipment</option>
                <option value="farrier">Farrier</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Total Amount ($) *</label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.total_amount}
                onChange={(e) => handleTotalChange(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="40.00"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Description</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="e.g., 4 bags of feed"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Date</label>
              <input
                type="date"
                value={formData.expense_date}
                onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Vendor</label>
            <input
              type="text"
              value={formData.vendor}
              onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
              placeholder="e.g., Tractor Supply"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* Split Mode Toggle */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleSplitModeChange('equal')}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                splitMode === 'equal'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Split Equally
            </button>
            <button
              type="button"
              onClick={() => handleSplitModeChange('custom')}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                splitMode === 'custom'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Custom Amounts
            </button>
          </div>

          {/* Animal Selection */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Select Animals *</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-2 bg-gray-900 rounded-lg">
              {animals.map(animal => {
                const isSelected = selectedAnimals.find(a => a.id === animal.id)
                return (
                  <button
                    key={animal.id}
                    type="button"
                    onClick={() => toggleAnimal(animal)}
                    className={`px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                      isSelected
                        ? 'bg-green-600/30 border-2 border-green-500'
                        : 'bg-gray-700 hover:bg-gray-600 border-2 border-transparent'
                    }`}
                  >
                    <div className="font-medium truncate">{animal.name}</div>
                    <div className="text-xs text-gray-400">{animal.animal_type}</div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Split Amounts */}
          {selectedAnimals.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-gray-400">
                  Split Amounts
                  {remaining !== 0 && formData.total_amount && (
                    <span className={`ml-2 ${Math.abs(remaining) < 0.01 ? 'text-green-400' : 'text-yellow-400'}`}>
                      (Remaining: ${remaining.toFixed(2)})
                    </span>
                  )}
                  {inputMode === 'percent' && percentTotal !== null && (
                    <span className={`ml-2 ${Math.abs(percentTotal - 100) < 0.01 ? 'text-green-400' : 'text-yellow-400'}`}>
                      ({percentTotal.toFixed(1)}%)
                    </span>
                  )}
                </label>
                {/* Input mode toggle - only show in custom mode */}
                {splitMode === 'custom' && (
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => handleInputModeChange('dollars')}
                      className={`px-2 py-1 rounded text-xs transition-colors ${
                        inputMode === 'dollars'
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                      }`}
                    >
                      $
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInputModeChange('percent')}
                      className={`px-2 py-1 rounded text-xs transition-colors ${
                        inputMode === 'percent'
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                      }`}
                    >
                      %
                    </button>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                {selectedAnimals.map(animal => (
                  <div key={animal.id} className="flex items-center gap-3 bg-gray-700 rounded-lg p-2">
                    <span className="flex-1 text-sm">{animal.name}</span>
                    <div className="flex items-center gap-1">
                      <span className="text-gray-400">{inputMode === 'percent' && splitMode === 'custom' ? '' : '$'}</span>
                      <input
                        type="number"
                        step={inputMode === 'percent' ? '1' : '0.01'}
                        value={animal.amount}
                        onChange={(e) => updateAnimalAmount(animal.id, e.target.value)}
                        disabled={splitMode === 'equal'}
                        className={`w-24 px-2 py-1 bg-gray-600 border border-gray-500 rounded text-right ${
                          splitMode === 'equal' ? 'opacity-60' : ''
                        }`}
                        placeholder={inputMode === 'percent' && splitMode === 'custom' ? '0' : '0.00'}
                      />
                      <span className="text-gray-400 w-4">{inputMode === 'percent' && splitMode === 'custom' ? '%' : ''}</span>
                    </div>
                    {/* Show calculated dollar amount when in percent mode */}
                    {inputMode === 'percent' && splitMode === 'custom' && animal.amount && (
                      <span className="text-xs text-green-400 w-20 text-right">
                        = ${getActualAmount(animal).toFixed(2)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !isValid}
              className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Create Split Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}


// Edit Date Modal Component
function EditDateModal({ label, currentDate, onClose, onSave }) {
  const [dateValue, setDateValue] = useState(() => {
    if (currentDate) {
      const d = safeParseDate(currentDate)
      // Format as YYYY-MM-DD for input
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      // Convert to ISO datetime string
      const datetime = new Date(dateValue + 'T12:00:00').toISOString()
      await onSave(datetime)
    } finally {
      setSaving(false)
    }
  }

  const setToToday = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    setDateValue(`${year}-${month}-${day}`)
  }

  const clearDate = async () => {
    setSaving(true)
    try {
      await onSave(null)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Edit {label}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Date</label>
            <input
              type="date"
              value={dateValue}
              onChange={(e) => setDateValue(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={setToToday}
              className="px-3 py-1.5 bg-cyan-900/50 hover:bg-cyan-800/50 rounded text-sm text-cyan-300 transition-colors"
            >
              Today
            </button>
            <button
              type="button"
              onClick={clearDate}
              disabled={saving}
              className="px-3 py-1.5 bg-red-900/50 hover:bg-red-800/50 rounded text-sm text-red-300 transition-colors disabled:opacity-50"
            >
              Clear
            </button>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-farm-green hover:bg-farm-green-light text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}


// Feed Form Modal
function FeedFormModal({ feed, animalName, onClose, onSave }) {
  const [formData, setFormData] = useState({
    feed_type: feed?.feed_type || '',
    amount: feed?.amount || '',
    frequency: feed?.frequency || '',
    notes: feed?.notes || '',
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave(formData)
    } catch (error) {
      console.error('Failed to save feed:', error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {feed ? 'Edit Feed' : 'Add Feed'} {animalName && `for ${animalName}`}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Feed Type *</label>
            <input
              type="text"
              required
              value={formData.feed_type}
              onChange={(e) => setFormData({ ...formData, feed_type: e.target.value })}
              placeholder="e.g., Grain, Hay, Pellets, Kibble"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Amount</label>
            <input
              type="text"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              placeholder="e.g., 2 cups, 1 scoop, 2 flakes"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Frequency</label>
            <select
              value={formData.frequency}
              onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
            >
              <option value="">-</option>
              <option value="Once daily">Once daily</option>
              <option value="Twice daily">Twice daily</option>
              <option value="3 times daily">3 times daily</option>
              <option value="4 times daily">4 times daily</option>
              <option value="Constant access">Constant access</option>
              <option value="As needed">As needed</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              placeholder="Optional notes about this feed"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : (feed ? 'Update' : 'Add Feed')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}


// Archive Livestock Modal - record final weights and create production record
function ArchiveFormModal({ animal, onClose, onSave }) {
  const [formData, setFormData] = useState({
    animal_id: animal.id,
    slaughter_date: animal.slaughter_date || new Date().toISOString().split('T')[0],
    processor: animal.processor || '',
    pickup_date: animal.pickup_date || '',
    live_weight: animal.current_weight || '',
    hanging_weight: '',
    final_weight: '',
    processing_cost: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave({
        ...formData,
        live_weight: formData.live_weight ? parseFloat(formData.live_weight) : null,
        hanging_weight: formData.hanging_weight ? parseFloat(formData.hanging_weight) : null,
        final_weight: formData.final_weight ? parseFloat(formData.final_weight) : null,
        processing_cost: formData.processing_cost ? parseFloat(formData.processing_cost) : null,
      })
    } catch (error) {
      console.error('Failed to archive:', error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Package className="w-5 h-5 text-orange-500" />
              Archive {animal.name}
            </h2>
            <p className="text-sm text-gray-400">
              Record production weights and archive this animal
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Summary */}
          <div className="bg-gray-700/50 rounded-lg p-3">
            <div className="text-sm text-gray-400 mb-1">Total Investment</div>
            <div className="text-xl font-bold text-green-400">
              ${(animal.total_expenses || 0).toFixed(2)}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Slaughter Date</label>
              <input
                type="date"
                value={formData.slaughter_date}
                onChange={(e) => setFormData({ ...formData, slaughter_date: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Pickup Date</label>
              <input
                type="date"
                value={formData.pickup_date}
                onChange={(e) => setFormData({ ...formData, pickup_date: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Processor</label>
            <input
              type="text"
              value={formData.processor}
              onChange={(e) => setFormData({ ...formData, processor: e.target.value })}
              placeholder="Butcher/Processor name"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Live Weight (lbs)</label>
              <input
                type="number"
                step="0.1"
                value={formData.live_weight}
                onChange={(e) => setFormData({ ...formData, live_weight: e.target.value })}
                placeholder="Before slaughter"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Hanging Weight (lbs)</label>
              <input
                type="number"
                step="0.1"
                value={formData.hanging_weight}
                onChange={(e) => setFormData({ ...formData, hanging_weight: e.target.value })}
                placeholder="Carcass weight"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Final Weight (lbs)</label>
              <input
                type="number"
                step="0.1"
                value={formData.final_weight}
                onChange={(e) => setFormData({ ...formData, final_weight: e.target.value })}
                placeholder="Packaged meat"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Processing Cost ($)</label>
            <input
              type="number"
              step="0.01"
              value={formData.processing_cost}
              onChange={(e) => setFormData({ ...formData, processing_cost: e.target.value })}
              placeholder="Butcher fees"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              placeholder="Any notes about the processing..."
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
            />
          </div>

          {/* Cost Per Pound Preview */}
          {formData.final_weight && parseFloat(formData.final_weight) > 0 && (
            <div className="bg-cyan-900/30 rounded-lg p-3">
              <div className="text-sm text-cyan-400">Estimated Cost Per Pound</div>
              <div className="text-lg font-bold text-cyan-300">
                ${(
                  ((animal.total_expenses || 0) + (parseFloat(formData.processing_cost) || 0)) /
                  parseFloat(formData.final_weight)
                ).toFixed(2)}/lb
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Archiving...' : 'Archive & Record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}


// Expense List Modal - View, edit, delete, duplicate expenses for an animal
function ExpenseListModal({ animal, onClose, onUpdate }) {
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingExpense, setEditingExpense] = useState(null)
  const [editFormData, setEditFormData] = useState(null)
  const [saving, setSaving] = useState(false)
  const [duplicatingExpense, setDuplicatingExpense] = useState(null)
  const [duplicateFormData, setDuplicateFormData] = useState(null)

  useEffect(() => {
    fetchExpenses()
  }, [animal.id])

  const fetchExpenses = async () => {
    try {
      const response = await getAnimalExpenses(animal.id, { limit: 100 })
      setExpenses(response.data)
    } catch (error) {
      console.error('Failed to fetch expenses:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (expense) => {
    setEditingExpense(expense.id)
    setEditFormData({
      expense_type: expense.expense_type,
      description: expense.description || '',
      amount: expense.amount.toString(),
      expense_date: expense.expense_date,
      vendor: expense.vendor || '',
      notes: expense.notes || '',
    })
  }

  const handleSaveEdit = async () => {
    if (!editFormData) return
    setSaving(true)
    try {
      await updateAnimalExpense(editingExpense, {
        ...editFormData,
        amount: parseFloat(editFormData.amount),
      })
      setEditingExpense(null)
      setEditFormData(null)
      fetchExpenses()
      onUpdate()
    } catch (error) {
      console.error('Failed to update expense:', error)
      alert('Failed to update expense: ' + (error.response?.data?.detail || error.message))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (expenseId) => {
    if (!confirm('Delete this expense?')) return
    try {
      await deleteAnimalExpense(expenseId)
      fetchExpenses()
      onUpdate()
    } catch (error) {
      console.error('Failed to delete expense:', error)
      alert('Failed to delete expense: ' + (error.response?.data?.detail || error.message))
    }
  }

  const handleDuplicate = (expense) => {
    // Prefill with expense data but set date to today
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')

    setDuplicatingExpense(expense.id)
    setDuplicateFormData({
      expense_type: expense.expense_type,
      description: expense.description || '',
      amount: expense.amount.toString(),
      expense_date: `${year}-${month}-${day}`,
      vendor: expense.vendor || '',
      notes: expense.notes || '',
    })
  }

  const handleSaveDuplicate = async () => {
    if (!duplicateFormData) return
    setSaving(true)
    try {
      await addAnimalExpense(animal.id, {
        ...duplicateFormData,
        amount: parseFloat(duplicateFormData.amount),
      })
      setDuplicatingExpense(null)
      setDuplicateFormData(null)
      fetchExpenses()
      onUpdate()
    } catch (error) {
      console.error('Failed to duplicate expense:', error)
      alert('Failed to duplicate expense: ' + (error.response?.data?.detail || error.message))
    } finally {
      setSaving(false)
    }
  }

  const total = expenses.reduce((sum, e) => sum + e.amount, 0)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Expenses for {animal.name}</h2>
            <div className="text-sm text-gray-400">Total: ${total.toFixed(2)}</div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={exportAnimalExpenses(animal.id)}
              className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 rounded text-sm transition-colors"
            >
              <Download className="w-4 h-4" /> Export CSV
            </a>
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center text-gray-400 py-8">Loading...</div>
          ) : expenses.length === 0 ? (
            <div className="text-center text-gray-400 py-8">No expenses recorded</div>
          ) : (
            <div className="space-y-2">
              {expenses.map(expense => (
                <div key={expense.id} className="bg-gray-700/50 rounded-lg p-3">
                  {editingExpense === expense.id ? (
                    // Edit form
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-2">
                        <select
                          value={editFormData.expense_type}
                          onChange={(e) => setEditFormData({ ...editFormData, expense_type: e.target.value })}
                          className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm"
                        >
                          <option value="purchase">Purchase Price</option>
                          <option value="feed">Feed</option>
                          <option value="medicine">Medicine</option>
                          <option value="vet">Vet Visit</option>
                          <option value="equipment">Equipment</option>
                          <option value="farrier">Farrier</option>
                          <option value="other">Other</option>
                        </select>
                        <input
                          type="number"
                          step="0.01"
                          value={editFormData.amount}
                          onChange={(e) => setEditFormData({ ...editFormData, amount: e.target.value })}
                          className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm"
                          placeholder="Amount"
                        />
                        <input
                          type="date"
                          value={editFormData.expense_date}
                          onChange={(e) => setEditFormData({ ...editFormData, expense_date: e.target.value })}
                          className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm"
                        />
                      </div>
                      <input
                        type="text"
                        value={editFormData.description}
                        onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                        className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm"
                        placeholder="Description"
                      />
                      <input
                        type="text"
                        value={editFormData.vendor}
                        onChange={(e) => setEditFormData({ ...editFormData, vendor: e.target.value })}
                        className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm"
                        placeholder="Vendor"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveEdit}
                          disabled={saving}
                          className="px-3 py-1 bg-green-600 hover:bg-green-500 rounded text-sm disabled:opacity-50"
                        >
                          {saving ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={() => { setEditingExpense(null); setEditFormData(null) }}
                          className="px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : duplicatingExpense === expense.id ? (
                    // Duplicate form - prefilled with expense data, today's date
                    <div className="space-y-3">
                      <div className="text-xs text-purple-400 font-medium mb-1">Duplicate Expense (edit before saving)</div>
                      <div className="grid grid-cols-3 gap-2">
                        <select
                          value={duplicateFormData.expense_type}
                          onChange={(e) => setDuplicateFormData({ ...duplicateFormData, expense_type: e.target.value })}
                          className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm"
                        >
                          <option value="purchase">Purchase Price</option>
                          <option value="feed">Feed</option>
                          <option value="medicine">Medicine</option>
                          <option value="vet">Vet Visit</option>
                          <option value="equipment">Equipment</option>
                          <option value="farrier">Farrier</option>
                          <option value="other">Other</option>
                        </select>
                        <input
                          type="number"
                          step="0.01"
                          value={duplicateFormData.amount}
                          onChange={(e) => setDuplicateFormData({ ...duplicateFormData, amount: e.target.value })}
                          className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm"
                          placeholder="Amount"
                        />
                        <input
                          type="date"
                          value={duplicateFormData.expense_date}
                          onChange={(e) => setDuplicateFormData({ ...duplicateFormData, expense_date: e.target.value })}
                          className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm"
                        />
                      </div>
                      <input
                        type="text"
                        value={duplicateFormData.description}
                        onChange={(e) => setDuplicateFormData({ ...duplicateFormData, description: e.target.value })}
                        className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm"
                        placeholder="Description"
                      />
                      <input
                        type="text"
                        value={duplicateFormData.vendor}
                        onChange={(e) => setDuplicateFormData({ ...duplicateFormData, vendor: e.target.value })}
                        className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm"
                        placeholder="Vendor"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveDuplicate}
                          disabled={saving}
                          className="px-3 py-1 bg-purple-600 hover:bg-purple-500 rounded text-sm disabled:opacity-50"
                        >
                          {saving ? 'Saving...' : 'Add Duplicate'}
                        </button>
                        <button
                          onClick={() => { setDuplicatingExpense(null); setDuplicateFormData(null) }}
                          className="px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    // Display mode
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs px-2 py-0.5 rounded bg-gray-600 capitalize">
                            {expense.expense_type}
                          </span>
                          <span className="font-medium text-green-400">${expense.amount.toFixed(2)}</span>
                          <span className="text-xs text-gray-400">{expense.expense_date}</span>
                        </div>
                        {expense.description && (
                          <div className="text-sm text-gray-300 mt-1 truncate">{expense.description}</div>
                        )}
                        {expense.vendor && (
                          <div className="text-xs text-gray-500 mt-0.5">@ {expense.vendor}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        <button
                          onClick={() => handleDuplicate(expense)}
                          className="p-1.5 text-gray-400 hover:text-purple-400 transition-colors"
                          title="Duplicate"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(expense)}
                          className="p-1.5 text-gray-400 hover:text-blue-400 transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(expense.id)}
                          className="p-1.5 text-gray-400 hover:text-red-400 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-700">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}


export default Animals
