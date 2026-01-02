import React, { useState, useEffect, useCallback } from 'react'
import {
  Plus, Search, PawPrint, Calendar, AlertCircle, ChevronDown, ChevronUp,
  MapPin, DollarSign, Scale, Clock, Check, X, Syringe, Scissors,
  Heart, Beef, Dog, Cat, Pencil, Save
} from 'lucide-react'
import {
  getAnimals, createAnimal, updateAnimal, deleteAnimal, addAnimalCareLog,
  addAnimalExpense, getAnimalExpenses, createCareSchedule, completeCareSchedule,
  deleteCareSchedule, updateCareSchedule, createBulkCareSchedule,
  createAnimalFeed, updateAnimalFeed, deleteAnimalFeed, getFarmAreas
} from '../services/api'
import { format, differenceInDays, parseISO, startOfDay } from 'date-fns'

// Predefined tags with colors
const ANIMAL_TAGS = {
  sick: { label: 'Sick', color: 'bg-red-600 text-white' },
  injured: { label: 'Injured', color: 'bg-orange-600 text-white' },
  pregnant: { label: 'Pregnant', color: 'bg-pink-600 text-white' },
  nursing: { label: 'Nursing', color: 'bg-purple-600 text-white' },
  quarantine: { label: 'Quarantine', color: 'bg-yellow-600 text-black' },
  for_sale: { label: 'For Sale', color: 'bg-green-600 text-white' },
  new: { label: 'New', color: 'bg-blue-600 text-white' },
  special_diet: { label: 'Special Diet', color: 'bg-cyan-600 text-white' },
  senior: { label: 'Senior', color: 'bg-gray-500 text-white' },
  breeding: { label: 'Breeding', color: 'bg-rose-600 text-white' },
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
function EditableField({ label, value, field, type = 'text', options, onChange, placeholder }) {
  const inputClass = "w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"

  if (type === 'select' && options) {
    return (
      <div>
        <label className="block text-xs text-gray-500 mb-1">{label}</label>
        <select
          value={value || ''}
          onChange={(e) => onChange(field, e.target.value)}
          className={inputClass}
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
        <label className="block text-xs text-gray-500 mb-1">{label}</label>
        <textarea
          value={value || ''}
          onChange={(e) => onChange(field, e.target.value)}
          placeholder={placeholder}
          rows={3}
          className={inputClass}
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
          className="w-4 h-4 rounded bg-gray-700 border-gray-600"
        />
        <span className="text-sm text-gray-300">{label}</span>
      </label>
    )
  }

  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input
        type={type}
        value={value || ''}
        onChange={(e) => onChange(field, e.target.value)}
        placeholder={placeholder}
        className={inputClass}
      />
    </div>
  )
}

function Animals() {
  const [animals, setAnimals] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingAnimal, setEditingAnimal] = useState(null)
  const [expandedAnimal, setExpandedAnimal] = useState(null)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState('all') // all, pet, livestock
  const [showExpenseForm, setShowExpenseForm] = useState(null) // animal_id or null
  const [editDateModal, setEditDateModal] = useState(null) // { animalId, field, label, currentDate }
  const [showCareScheduleForm, setShowCareScheduleForm] = useState(null) // animal_id or null
  const [editingCareSchedule, setEditingCareSchedule] = useState(null) // schedule object
  const [showBulkCareForm, setShowBulkCareForm] = useState(false)
  const [showFeedForm, setShowFeedForm] = useState(null) // animal_id or null
  const [editingFeed, setEditingFeed] = useState(null) // { animalId, ...feed }
  const [farmAreas, setFarmAreas] = useState([])

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

  const getUrgencyClass = (days) => {
    if (days === null) return 'bg-gray-700 text-gray-300'
    if (days <= 0) return 'bg-red-900/50 text-red-300 border border-red-700'
    if (days <= 7) return 'bg-red-900/30 text-red-300'
    if (days <= 14) return 'bg-yellow-900/30 text-yellow-300'
    return 'bg-gray-700 text-gray-300'
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
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <PawPrint className="w-7 h-7 text-blue-500" />
          Animals
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBulkCareForm(true)}
            className="flex items-center gap-2 px-3 py-2 bg-cyan-700 hover:bg-cyan-600 rounded-lg transition-colors text-sm"
          >
            <Calendar className="w-4 h-4" />
            Bulk Care
          </button>
          <button
            onClick={() => { setEditingAnimal(null); setShowForm(true) }}
            className="flex items-center gap-2 px-4 py-2 bg-farm-green hover:bg-farm-green-light rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Animal
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Heart className="w-5 h-5 text-pink-400" />
            <span className="text-2xl font-bold text-pink-400">{stats.totalPets}</span>
          </div>
          <div className="text-sm text-gray-400">Pets</div>
        </div>
        <div className="bg-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Beef className="w-5 h-5 text-amber-400" />
            <span className="text-2xl font-bold text-amber-400">{stats.totalLivestock}</span>
          </div>
          <div className="text-sm text-gray-400">Livestock</div>
        </div>
        <div className="bg-gray-800 rounded-xl p-4">
          <div className="text-2xl font-bold text-red-400">{stats.needsAttention}</div>
          <div className="text-sm text-gray-400">Need Attention</div>
        </div>
        <div className="bg-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-1">
            <DollarSign className="w-5 h-5 text-green-400" />
            <span className="text-2xl font-bold text-green-400">
              {stats.totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
          </div>
          <div className="text-sm text-gray-400">Total Expenses</div>
        </div>
      </div>

      {/* Tabs and Filters */}
      <div className="flex flex-wrap gap-4">
        {/* Category Tabs */}
        <div className="flex bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'all' ? 'bg-farm-green text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            All ({animals.length})
          </button>
          <button
            onClick={() => setActiveTab('pet')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
              activeTab === 'pet' ? 'bg-pink-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Heart className="w-4 h-4" /> Pets ({pets.length})
          </button>
          <button
            onClick={() => setActiveTab('livestock')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
              activeTab === 'livestock' ? 'bg-amber-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Beef className="w-4 h-4" /> Livestock ({livestock.length})
          </button>
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search animals..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
          />
        </div>
      </div>

      {/* Animal List */}
      {filteredAnimals.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <PawPrint className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>No animals found. Add your first animal!</p>
        </div>
      ) : (
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
              onAddExpense={() => setShowExpenseForm(animal.id)}
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
              getAnimalIcon={getAnimalIcon}
              getDaysUntil={getDaysUntil}
              getUrgencyClass={getUrgencyClass}
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

      {/* Add Expense Modal */}
      {showExpenseForm && (
        <ExpenseFormModal
          animalId={showExpenseForm}
          animalName={animals.find(a => a.id === showExpenseForm)?.name}
          onClose={() => setShowExpenseForm(null)}
          onSave={(data) => addExpense(showExpenseForm, data)}
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
  animal, farmAreas = [], expanded, onToggle, onLogCare, onDelete, onAddExpense, onEditDate, onToggleTag,
  onAddCareSchedule, onCompleteCareSchedule, onDeleteCareSchedule, onEditCareSchedule,
  onAddFeed, onEditFeed, onDeleteFeed, onSave, getAnimalIcon, getDaysUntil, getUrgencyClass
}) {
  // Local state for inline editing
  const [editData, setEditData] = useState(null)
  const [saving, setSaving] = useState(false)

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
        barn: animal.barn || '',
        farm_area_id: animal.farm_area_id || '',
        notes: animal.notes || '',
        special_instructions: animal.special_instructions || '',
        target_weight: animal.target_weight || '',
        slaughter_date: animal.slaughter_date || '',
        processor: animal.processor || '',
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
        farm_area_id: editData.farm_area_id ? parseInt(editData.farm_area_id) : null,
      }
      await updateAnimal(animal.id, data)
      if (onSave) onSave()
    } catch (error) {
      console.error('Failed to save:', error)
      alert('Failed to save changes')
    } finally {
      setSaving(false)
    }
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
    <div className={`bg-gray-800 rounded-lg overflow-hidden ${
      isPet ? 'border-l-4 border-pink-500' : isLivestock ? 'border-l-4 border-amber-500' : ''
    }`}>
      {/* Compact Card Header - flows naturally */}
      <div
        className="px-4 py-2 flex items-center gap-2 cursor-pointer hover:bg-gray-750"
        onClick={onToggle}
      >
        {/* Icon */}
        <span className="text-xl flex-shrink-0">{getAnimalIcon(animal.animal_type)}</span>

        {/* Name */}
        <span className="font-semibold text-white truncate">{animal.name}</span>

        {/* Tags - after name */}
        {animalTags.slice(0, 2).map(tag => {
          const tagInfo = ANIMAL_TAGS[tag] || { label: tag, color: 'bg-gray-600 text-white' }
          return (
            <span key={tag} className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${tagInfo.color}`}>
              {tagInfo.label}
            </span>
          )
        })}

        {/* Separator */}
        <span className="text-gray-600">·</span>

        {/* Feeding Info: amount, type, frequency */}
        <span className="text-sm text-cyan-400 truncate">
          {animal.feeds && animal.feeds.length > 0
            ? animal.feeds.map(f => [f.amount, f.feed_type, f.frequency].filter(Boolean).join(' ')).join(' | ')
            : [animal.feed_amount, animal.feed_type, animal.feed_frequency].filter(Boolean).join(' ')
          }
        </span>

        {/* Separator */}
        <span className="text-gray-600">·</span>

        {/* Color + Type together (grey) like "Black Horse" */}
        <span className="text-xs text-gray-500 truncate capitalize">
          {[animal.color, animal.animal_type?.replace('_', ' ')].filter(Boolean).join(' ')}
        </span>

        {/* Farm Area if assigned */}
        {animal.farm_area && (
          <>
            <span className="text-gray-600">·</span>
            <span className="text-xs text-emerald-500 flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {animal.farm_area.name}
            </span>
          </>
        )}

        {/* Spacer to push status indicators right */}
        <span className="flex-1"></span>

        {/* Status Indicators - right side: notes, slaughter, cost, overdue */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {animal.notes && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-gray-700 text-gray-400" title={animal.notes}>
              See Notes
            </span>
          )}
          {isLivestock && slaughterDays !== null && (
            <span className={`text-xs px-2 py-1 rounded ${getUrgencyClass(slaughterDays)}`}>
              {slaughterDays <= 0 ? 'Ready' : `${slaughterDays} days until slaughter`}
            </span>
          )}
          {animal.total_expenses > 0 && (
            <span className="text-xs px-2 py-1 rounded bg-green-900/30 text-green-300">
              ${animal.total_expenses.toFixed(0)}
            </span>
          )}
          {overdueItems.length > 0 && (
            <span className="text-xs px-2 py-1 rounded bg-red-900/50 text-red-300 border border-red-700">
              {overdueItems.length} due
            </span>
          )}
        </div>

        {/* Expand Icon */}
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
        )}
      </div>

      {/* Expanded Details */}
      {expanded && editData && (
        <div className="px-4 pb-4 border-t border-gray-700 pt-4 space-y-4">

          {/* Action Buttons - Save, Quick actions, Delete */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={(e) => { e.stopPropagation(); handleSave() }}
              disabled={saving}
              className="px-3 py-1.5 bg-farm-green hover:bg-farm-green-light rounded text-sm text-white transition-colors flex items-center gap-1 disabled:opacity-50"
            >
              <Save className="w-3 h-3" /> {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onAddExpense() }}
              className="px-3 py-1.5 bg-green-600/50 hover:bg-green-600 rounded text-sm text-white transition-colors flex items-center gap-1"
            >
              <DollarSign className="w-3 h-3" /> Add Expense
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
              className="px-3 py-1.5 bg-blue-900/50 hover:bg-blue-800/50 rounded text-sm text-white transition-colors flex items-center gap-1"
            >
              <Scale className="w-3 h-3" /> Log Weight
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                const notes = prompt('Vet visit notes:')
                if (notes) onLogCare(animal.id, 'vet_visit', { notes })
              }}
              className="px-3 py-1.5 bg-red-900/50 hover:bg-red-800/50 rounded text-sm text-white transition-colors flex items-center gap-1"
            >
              🏥 Vet Visit
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete() }}
              className="px-3 py-1.5 bg-red-600/50 hover:bg-red-600 rounded text-sm text-white transition-colors flex items-center gap-1 ml-auto"
            >
              <X className="w-3 h-3" /> Delete
            </button>
          </div>

          {/* Inline Editable Details */}
          <div className="bg-gray-900/50 rounded-lg p-3">
            <h4 className="text-sm font-medium text-gray-400 mb-3">Details</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <EditableField
                label="Name"
                value={editData.name}
                field="name"
                onChange={handleFieldChange}
              />
              <EditableField
                label="Type"
                value={editData.animal_type}
                field="animal_type"
                type="select"
                options={ANIMAL_TYPE_OPTIONS}
                onChange={handleFieldChange}
              />
              <EditableField
                label="Category"
                value={editData.category}
                field="category"
                type="select"
                options={CATEGORY_OPTIONS}
                onChange={handleFieldChange}
              />
              <EditableField
                label="Breed"
                value={editData.breed}
                field="breed"
                onChange={handleFieldChange}
                placeholder="e.g., Labrador"
              />
              <EditableField
                label="Color"
                value={editData.color}
                field="color"
                onChange={handleFieldChange}
                placeholder="e.g., Black"
              />
              <EditableField
                label="Sex"
                value={editData.sex}
                field="sex"
                type="select"
                options={getSexOptions(editData.animal_type)}
                onChange={handleFieldChange}
              />
              <EditableField
                label="Tag #"
                value={editData.tag_number}
                field="tag_number"
                onChange={handleFieldChange}
              />
              <EditableField
                label="Microchip"
                value={editData.microchip}
                field="microchip"
                onChange={handleFieldChange}
              />
              <EditableField
                label="Birth Date"
                value={editData.birth_date}
                field="birth_date"
                type="date"
                onChange={handleFieldChange}
              />
              <EditableField
                label="Acquired Date"
                value={editData.acquisition_date}
                field="acquisition_date"
                type="date"
                onChange={handleFieldChange}
              />
              <EditableField
                label="Current Weight (lbs)"
                value={editData.current_weight}
                field="current_weight"
                type="number"
                onChange={handleFieldChange}
              />
              <EditableField
                label="Farm Area"
                value={editData.farm_area_id}
                field="farm_area_id"
                type="select"
                options={[{ value: '', label: 'No area' }, ...farmAreas.map(a => ({ value: a.id.toString(), label: a.name }))]}
                onChange={handleFieldChange}
              />
              <EditableField
                label="Pasture/Location"
                value={editData.pasture}
                field="pasture"
                onChange={handleFieldChange}
              />
              <EditableField
                label="Barn"
                value={editData.barn}
                field="barn"
                onChange={handleFieldChange}
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
              />
            </div>
          </div>

          {/* Livestock-specific fields */}
          {isLivestock && (
            <div className="bg-gray-900/50 rounded-lg p-3">
              <h4 className="text-sm font-medium text-gray-400 mb-3">Livestock Details</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <EditableField
                  label="Target Weight (lbs)"
                  value={editData.target_weight}
                  field="target_weight"
                  type="number"
                  onChange={handleFieldChange}
                />
                <EditableField
                  label="Slaughter Date"
                  value={editData.slaughter_date}
                  field="slaughter_date"
                  type="date"
                  onChange={handleFieldChange}
                />
                <EditableField
                  label="Processor"
                  value={editData.processor}
                  field="processor"
                  onChange={handleFieldChange}
                  placeholder="Processor name"
                />
              </div>
            </div>
          )}

          {/* Care Frequency Settings */}
          <div className="bg-gray-900/50 rounded-lg p-3">
            <h4 className="text-sm font-medium text-gray-400 mb-3">Care Frequency (days)</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <EditableField
                label="Worming"
                value={editData.worming_frequency_days}
                field="worming_frequency_days"
                type="number"
                onChange={handleFieldChange}
                placeholder="e.g., 90"
              />
              <EditableField
                label="Vaccination"
                value={editData.vaccination_frequency_days}
                field="vaccination_frequency_days"
                type="number"
                onChange={handleFieldChange}
                placeholder="e.g., 365"
              />
              <EditableField
                label="Hoof Trim"
                value={editData.hoof_trim_frequency_days}
                field="hoof_trim_frequency_days"
                type="number"
                onChange={handleFieldChange}
                placeholder="e.g., 60"
              />
              <EditableField
                label="Dental"
                value={editData.dental_frequency_days}
                field="dental_frequency_days"
                type="number"
                onChange={handleFieldChange}
                placeholder="e.g., 365"
              />
            </div>
          </div>

          {/* Cold Sensitivity */}
          <div className="bg-gray-900/50 rounded-lg p-3">
            <h4 className="text-sm font-medium text-gray-400 mb-3">Cold Sensitivity</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
              <EditableField
                label="Cold Sensitive"
                value={editData.cold_sensitive}
                field="cold_sensitive"
                type="checkbox"
                onChange={handleFieldChange}
              />
              {editData.cold_sensitive && (
                <>
                  <EditableField
                    label="Min Temp (°F)"
                    value={editData.min_temp}
                    field="min_temp"
                    type="number"
                    onChange={handleFieldChange}
                  />
                  <EditableField
                    label="Blanket Below (°F)"
                    value={editData.needs_blanket_below}
                    field="needs_blanket_below"
                    type="number"
                    onChange={handleFieldChange}
                  />
                </>
              )}
            </div>
          </div>

          {/* Feeding Info - Multiple Feeds */}
          <div className="bg-gray-900/50 rounded-lg p-3">
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
          <div className="bg-gray-900/50 rounded-lg p-3">
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
                <div className={`p-3 rounded-lg ${getUrgencyClass(slaughterDays)}`}>
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
            </div>
          )}

          {/* Tags */}
          <div className="bg-gray-900/50 rounded-lg p-3">
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
    notes: schedule?.notes || '',
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
        notes: formData.notes || null,
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

          <div>
            <label className="block text-sm text-gray-400 mb-1">Manual Due Date</label>
            <input
              type="date"
              value={formData.manual_due_date}
              onChange={(e) => setFormData({ ...formData, manual_due_date: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
            />
            <p className="text-xs text-gray-500 mt-1">Overrides calculated due date from frequency</p>
          </div>

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
              className="flex-1 px-4 py-2 bg-farm-green hover:bg-farm-green-light rounded-lg transition-colors disabled:opacity-50"
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
    last_performed: '',
    manual_due_date: '',
    notes: '',
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
        frequency_days: formData.frequency_days ? parseInt(formData.frequency_days) : null,
        last_performed: formData.last_performed || null,
        manual_due_date: formData.manual_due_date || null,
        notes: formData.notes || null,
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
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
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
              className="flex-1 px-4 py-2 bg-farm-green hover:bg-farm-green-light rounded-lg transition-colors disabled:opacity-50"
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
function AnimalFormModal({ animal, farmAreas = [], onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: animal?.name || '',
    animal_type: animal?.animal_type || 'dog',
    category: animal?.category || 'pet',
    breed: animal?.breed || '',
    color: animal?.color || '',
    tag_number: animal?.tag_number || '',
    sex: animal?.sex || '',
    birth_date: animal?.birth_date || '',
    acquisition_date: animal?.acquisition_date || '',
    current_weight: animal?.current_weight || '',
    pasture: animal?.pasture || '',
    farm_area_id: animal?.farm_area_id || '',
    notes: animal?.notes || '',
    special_instructions: animal?.special_instructions || '',
    // Livestock
    target_weight: animal?.target_weight || '',
    slaughter_date: animal?.slaughter_date || '',
    processor: animal?.processor || '',
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
        farm_area_id: formData.farm_area_id ? parseInt(formData.farm_area_id) : null,
      }

      if (animal) {
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
          <h2 className="text-xl font-semibold">{animal ? 'Edit Animal' : 'Add New Animal'}</h2>
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
            <div>
              <label className="block text-sm text-gray-400 mb-1">Farm Area</label>
              <select
                value={formData.farm_area_id}
                onChange={(e) => setFormData({ ...formData, farm_area_id: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
              >
                <option value="">No area assigned</option>
                {farmAreas.map(area => (
                  <option key={area.id} value={area.id}>{area.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Pasture/Barn</label>
              <input
                type="text"
                value={formData.pasture}
                onChange={(e) => setFormData({ ...formData, pasture: e.target.value })}
                placeholder="e.g., Front pasture, Barn stall 3"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
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
                <div className="col-span-2">
                  <label className="block text-sm text-gray-400 mb-1">Processor</label>
                  <input
                    type="text"
                    value={formData.processor}
                    onChange={(e) => setFormData({ ...formData, processor: e.target.value })}
                    placeholder="Slaughterhouse or processor name"
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
              className="flex-1 px-4 py-2 bg-farm-green hover:bg-farm-green-light rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : (animal ? 'Update Animal' : 'Add Animal')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}


// Expense Form Modal
function ExpenseFormModal({ animalId, animalName, onClose, onSave }) {
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave({
        ...formData,
        amount: parseFloat(formData.amount),
      })
    } catch (error) {
      console.error('Failed to save expense:', error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl w-full max-w-md">
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Add Expense for {animalName}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
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
              <label className="block text-sm text-gray-400 mb-1">Amount ($) *</label>
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

          <div className="flex gap-3 pt-4">
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
              className="flex-1 px-4 py-2 bg-farm-green hover:bg-farm-green-light rounded-lg transition-colors disabled:opacity-50"
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

export default Animals
