import React, { useState, useEffect } from 'react'
import { Plus, X, Palette, Edit2, Trash2, ShoppingCart, Home, Leaf, Check, Clipboard, Star, Book, Package, Wheat, PawPrint, Wrench } from 'lucide-react'
import {
  getLists,
  createList,
  updateList,
  deleteList,
  getTasks,
  getUpcomingTasks,
  getOverdueTasks,
  createTask,
  updateTask,
  deleteTask,
  completeTask,
  uncompleteTask,
  toggleBacklog,
  syncCalendar,
  getSettings,
  getWorkers,
  getTaskMetrics,
  getTeamMembers,
} from '../services/api'
import { useSettings } from '../contexts/SettingsContext'
import { format, isAfter, startOfDay, parseISO, addDays, endOfWeek, endOfMonth, isWithinInterval, isSameDay, isToday, isTomorrow } from 'date-fns'
import TaskList from '../components/TaskList'
import MottoDisplay from '../components/MottoDisplay'

// Import ToDo component logic
import ToDo from './ToDo'

// Icon map for rendering lucide component names as actual components
const ICON_MAP = {
  ShoppingCart, Home, Leaf, Check, Clipboard, Star, Book, Package, Wheat, PawPrint, Wrench
}

function Lists() {
  const { formatTime, formatDate } = useSettings()
  const [lists, setLists] = useState([])
  const [selectedListId, setSelectedListId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showListForm, setShowListForm] = useState(false)
  const [editingList, setEditingList] = useState(null)
  const [listFormData, setListFormData] = useState({ name: '', color: '#10b981', icon: '' })
  const [showListMenu, setShowListMenu] = useState(false)
  const [showIconPicker, setShowIconPicker] = useState(false)

  // Load lists on mount
  useEffect(() => {
    loadLists()
  }, [])

  const loadLists = async () => {
    try {
      setLoading(true)
      const response = await getLists()
      setLists(response.data || [])
      // Auto-select the first list or default list
      if (response.data && response.data.length > 0) {
        const defaultList = response.data.find(l => l.is_default) || response.data[0]
        setSelectedListId(defaultList.id)
      }
    } catch (error) {
      console.error('Failed to load lists:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateList = async (e) => {
    e.preventDefault()
    try {
      if (!listFormData.name.trim()) {
        alert('List name is required')
        return
      }
      await createList(listFormData)
      setListFormData({ name: '', color: '#10b981', icon: '' })
      setShowListForm(false)
      await loadLists()
    } catch (error) {
      console.error('Failed to create list:', error)
      alert(error.response?.data?.detail || 'Failed to create list')
    }
  }

  const handleUpdateList = async (e) => {
    e.preventDefault()
    try {
      if (!listFormData.name.trim()) {
        alert('List name is required')
        return
      }
      const updateData = listFormData
      
      await updateList(editingList.id, updateData)
      setListFormData({ name: '', color: '#10b981', icon: '' })
      setEditingList(null)
      await loadLists()
    } catch (error) {
      console.error('Failed to update list:', error)
      alert(error.response?.data?.detail || 'Failed to update list')
    }
  }

  const handleDeleteList = async (listId) => {
    if (!confirm('Delete this list? Tasks will be unlinked but not deleted.')) return
    try {
      await deleteList(listId)
      await loadLists()
    } catch (error) {
      console.error('Failed to delete list:', error)
      alert(error.response?.data?.detail || 'Failed to delete list')
    }
  }

  const startEdit = (list) => {
    setEditingList(list)
    setListFormData({ 
      name: list.name, 
      color: list.color || '#10b981', 
      icon: list.icon || ''
    })
    setShowListForm(true)
  }


  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  return (
    <div className="flex h-full gap-4">
      {/* List Sidebar */}
      <div className="w-64 bg-surface rounded-lg p-4 shadow border border-border">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-content">Lists</h2>
            <button
              onClick={() => setShowListForm(true)}
              className="p-1 hover:bg-surface-hover rounded text-primary-600"
            >
              <Plus size={18} />
            </button>
          </div>

          {/* List Items */}
          <div className="space-y-2">
            {lists.map(list => (
              <div
                key={list.id}
                onClick={() => setSelectedListId(list.id)}
                className={`p-3 rounded cursor-pointer transition ${
                  selectedListId === list.id
                    ? 'bg-primary-600 text-white'
                    : 'bg-surface-hover hover:bg-surface-hover text-content'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {list.icon && (() => {
                      const Icon = ICON_MAP[list.icon]
                      return Icon ? <Icon size={16} /> : <span>{list.icon}</span>
                    })()}
                    <span className="font-medium text-sm truncate">{list.name}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    {selectedListId === list.id && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          startEdit(list)
                        }}
                        className="p-1 hover:bg-white hover:bg-opacity-20 rounded"
                      >
                        <Edit2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content - ToDo List */}
      <div className="flex-1">
        {selectedListId ? (
          <ToDo listId={selectedListId} />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-content-muted">Select a list to view tasks</p>
          </div>
        )}
      </div>

      {/* List Form Modal */}
      {showListForm && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-lg p-6 max-w-md w-full shadow-lg border border-border">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                {editingList ? 'Edit List' : 'Create List'}
              </h3>
              <button
                onClick={() => {
                  setShowListForm(false)
                  setEditingList(null)
                  setListFormData({ name: '', color: '#10b981', icon: '' })
                }}
                className="text-content-muted hover:text-content"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={editingList ? handleUpdateList : handleCreateList} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">List Name</label>
                <input
                  type="text"
                  value={listFormData.name}
                  onChange={(e) => setListFormData({ ...listFormData, name: e.target.value })}
                  placeholder="e.g., Grocery, Shopping"
                  className="w-full px-3 py-2 border border-border rounded bg-surface-app text-content placeholder:text-content-muted"
                />
              </div>


              <div>
                <label className="block text-sm font-medium mb-1">Color</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={listFormData.color}
                    onChange={(e) => setListFormData({ ...listFormData, color: e.target.value })}
                    className="w-12 h-10 rounded cursor-pointer border border-border"
                  />
                  <input
                    type="text"
                    value={listFormData.color}
                    onChange={(e) => setListFormData({ ...listFormData, color: e.target.value })}
                    className="flex-1 px-3 py-2 border border-border rounded bg-surface-app text-content text-sm font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Icon (optional)</label>
                {showIconPicker ? (
                  <div>
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      {[
                        { name: 'None', icon: null },
                        { name: 'ShoppingCart', icon: <ShoppingCart size={20} /> },
                        { name: 'Home', icon: <Home size={20} /> },
                        { name: 'Leaf', icon: <Leaf size={20} /> },
                        { name: 'Check', icon: <Check size={20} /> },
                        { name: 'Clipboard', icon: <Clipboard size={20} /> },
                        { name: 'Star', icon: <Star size={20} /> },
                        { name: 'Book', icon: <Book size={20} /> },
                        { name: 'Package', icon: <Package size={20} /> },
                        { name: 'Wheat', icon: <Wheat size={20} /> },
                        { name: 'PawPrint', icon: <PawPrint size={20} /> },
                        { name: 'Wrench', icon: <Wrench size={20} /> },
                      ].map(({ name, icon }) => (
                        <button
                          key={name}
                          type="button"
                          onClick={() => {
                            setListFormData({ ...listFormData, icon: name === 'None' ? '' : name })
                            setShowIconPicker(false)
                          }}
                          className={`p-2 rounded border-2 flex items-center justify-center transition ${
                            (name === 'None' && listFormData.icon === '') || (name !== 'None' && listFormData.icon === name)
                              ? 'border-primary-600 bg-primary-600 text-white'
                              : 'border-border bg-surface-app hover:border-primary-600'
                          }`}
                        >
                          {icon ? icon : <span className="text-2xl">✕</span>}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowIconPicker(false)}
                      className="w-full px-3 py-2 border border-border rounded text-sm text-content-muted hover:text-content"
                    >
                      Use Custom
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={listFormData.icon}
                      onChange={(e) => setListFormData({ ...listFormData, icon: e.target.value })}
                      placeholder="e.g., 🛒, 🍕, 📚 or icon name"
                      className="w-full px-3 py-2 border border-border rounded bg-surface-app text-content placeholder:text-content-muted"
                    />
                    <button
                      type="button"
                      onClick={() => setShowIconPicker(true)}
                      className="w-full px-3 py-2 border border-border rounded text-sm font-medium text-content hover:bg-surface-hover transition"
                    >
                      Choose from Library
                    </button>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded font-medium hover:bg-primary-700"
                >
                  {editingList ? 'Update' : 'Create'}
                </button>
                {editingList && (
                  <button
                    type="button"
                    onClick={() => {
                      handleDeleteList(editingList.id)
                      setShowListForm(false)
                      setEditingList(null)
                    }}
                    className="px-4 py-2 bg-error-600 text-white rounded font-medium hover:bg-error-700"
                  >
                    Delete
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Lists
