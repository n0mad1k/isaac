import React, { useState, useEffect, useRef } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Menu, MoreVertical, Keyboard, MessageSquarePlus, RotateCcw, X, Send, Loader2, Plus, Minus, Home, Leaf, PawPrint, ListTodo, Calendar, Sprout, Settings, Car, Wrench, Fence, Package, Bug, ClipboardList, LayoutDashboard, LogOut, Users, DollarSign, UsersRound, Wheat, Bot, ShoppingBag, CreditCard, ChevronDown, ChevronRight } from 'lucide-react'
import { checkFeedbackEnabled, submitFeedback, toggleKeyboard as toggleKeyboardApi, getTeamGear, getGearContents, updateGearContents, createBudgetTransaction, getBudgetCategories, getBudgetAccounts } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import EventModal from './EventModal'

/**
 * Floating Action Menu - Combined navigation and actions menu
 * On mobile: shows nav + actions in fullscreen overlay
 * On desktop: shows just actions in expandable menu
 */
function FloatingActionMenu({ showKeyboard = false, showHardRefresh = true, navItems = [], isDevInstance = false, workerTasksEnabled = false, onChatToggle = null, unreadInsights = 0 }) {
  const [expanded, setExpanded] = useState(false)
  const [feedbackEnabled, setFeedbackEnabled] = useState(false)
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false)
  const [quickAddModalOpen, setQuickAddModalOpen] = useState(false)
  const [quickGearModalOpen, setQuickGearModalOpen] = useState(false)
  const [quickTransactionModalOpen, setQuickTransactionModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState(null)
  const menuRef = useRef(null)
  const location = useLocation()
  const { user, logout, isAdmin } = useAuth()

  // Form state for feedback
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [feedbackType, setFeedbackType] = useState('feature')
  const [submittedBy, setSubmittedBy] = useState('')

  // Default nav items if not provided
  const defaultNavItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dash' },
    { to: '/todo', icon: ListTodo, label: 'To Do' },
    { to: '/calendar', icon: Calendar, label: 'Calendar' },
    ...(workerTasksEnabled ? [{ to: '/worker-tasks', icon: ClipboardList, label: 'Workers' }] : []),
    { to: '/plants', icon: Leaf, label: 'Plants' },
    { to: '/seeds', icon: Sprout, label: 'Seeds' },
    { to: '/animals', icon: PawPrint, label: 'Animals' },
    { to: '/home-maintenance', icon: Home, label: 'Home' },
    { to: '/vehicles', icon: Car, label: 'Vehicles' },
    { to: '/equipment', icon: Wrench, label: 'Equip' },
    { to: '/farm-areas', icon: Fence, label: 'Farm' },
    { to: '/production', icon: Package, label: 'Prod' },
    ...(isDevInstance ? [{ to: '/dev-tracker', icon: Bug, label: 'Dev' }] : []),
    { to: '/settings', icon: Settings, label: 'Settings' },
  ]

  const navigation = navItems.length > 0 ? navItems : defaultNavItems

  // Close menu on navigation
  useEffect(() => {
    setExpanded(false)
  }, [location.pathname])

  // Check if feedback is enabled
  useEffect(() => {
    const checkEnabled = async () => {
      try {
        const response = await checkFeedbackEnabled()
        setFeedbackEnabled(response.data.enabled)
      } catch (e) {
        setFeedbackEnabled(false)
      }
    }
    checkEnabled()
  }, [])

  // Close menu when clicking outside (desktop only)
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Only close on outside click for desktop (non-fullscreen mode)
      if (window.innerWidth >= 768 && menuRef.current && !menuRef.current.contains(event.target)) {
        setExpanded(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [])

  const handleToggleKeyboard = async () => {
    try {
      await toggleKeyboardApi()
      setExpanded(false)
    } catch (err) {
      console.error('Keyboard toggle failed:', err)
    }
  }

  const handleHardRefresh = () => {
    setExpanded(false)
    if ('caches' in window) {
      caches.keys().then(names => names.forEach(name => caches.delete(name)))
    }
    window.location.reload(true)
  }

  const handleOpenFeedback = () => {
    setExpanded(false)
    setFeedbackModalOpen(true)
  }

  const handleOpenQuickAdd = () => {
    setExpanded(false)
    setQuickAddModalOpen(true)
  }

  const handleQuickAddClose = () => {
    setQuickAddModalOpen(false)
  }

  const handleQuickAddSaved = () => {
    setQuickAddModalOpen(false)
    window.dispatchEvent(new CustomEvent('task-created'))
  }

  const handleOpenChat = () => {
    setExpanded(false)
    if (onChatToggle) onChatToggle()
  }

  const handleOpenQuickGear = () => {
    setExpanded(false)
    setQuickGearModalOpen(true)
  }

  const handleOpenQuickTransaction = () => {
    setExpanded(false)
    setQuickTransactionModalOpen(true)
  }

  const handleLogout = async () => {
    setExpanded(false)
    await logout()
  }

  const handleSubmitFeedback = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      await submitFeedback({
        title,
        description,
        feedback_type: feedbackType,
        submitted_by: submittedBy || null
      })
      setSubmitted(true)
      setTitle('')
      setDescription('')
      setFeedbackType('feature')
      setSubmittedBy('')
      setTimeout(() => {
        setFeedbackModalOpen(false)
        setSubmitted(false)
      }, 2000)
    } catch (e) {
      setError(e.userMessage || 'Failed to submit feedback')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Mobile: Fullscreen menu overlay */}
      {expanded && (
        <div className="md:hidden fixed inset-0 z-40 flex flex-col" style={{ backgroundColor: 'var(--color-bg-app)' }}>
          {/* Header with user info and close button */}
          <div className="flex items-center justify-between px-4 py-3" style={{ backgroundColor: 'var(--color-nav-bg)', borderBottom: '1px solid var(--color-border-strong)' }}>
            <span className="text-lg font-semibold" style={{ color: 'var(--accent-primary)' }}>Menu</span>
            <div className="flex items-center gap-2">
              {user && (
                <>
                  <span className="text-sm text-gray-400">{user.display_name || user.username}</span>
                  {isAdmin && (
                    <NavLink
                      to="/settings"
                      state={{ tab: 'users' }}
                      className="p-2 rounded-lg text-gray-400 hover:text-white transition-colors"
                      title="User Management"
                    >
                      <Users className="w-5 h-5" />
                    </NavLink>
                  )}
                  <button
                    onClick={handleLogout}
                    className="p-2 rounded-lg text-red-400 hover:text-red-300 transition-colors"
                    title="Log Out"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                </>
              )}
              <button
                onClick={() => setExpanded(false)}
                className="p-2 rounded-lg text-gray-400 hover:text-white transition-colors ml-2"
                title="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Quick Actions - At top for easy mobile access */}
          <div className="p-3 pb-0">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleOpenQuickAdd}
                className="flex items-center justify-center gap-2 p-3 rounded-lg transition-colors touch-manipulation"
                style={{
                  backgroundColor: 'var(--color-green-600)',
                  color: 'white',
                  minHeight: '48px'
                }}
              >
                <Plus className="w-5 h-5" />
                <span className="text-sm font-medium">Add Event</span>
              </button>
              <button
                onClick={handleOpenQuickGear}
                className="flex items-center justify-center gap-2 p-3 rounded-lg transition-colors touch-manipulation"
                style={{
                  backgroundColor: 'var(--color-bg-surface)',
                  border: '1px solid var(--color-border-default)',
                  color: 'var(--color-text-primary)',
                  minHeight: '48px'
                }}
              >
                <ShoppingBag className="w-5 h-5" />
                <span className="text-sm font-medium">Quick Gear</span>
              </button>
              <button
                onClick={handleOpenQuickTransaction}
                className="flex items-center justify-center gap-2 p-3 rounded-lg transition-colors touch-manipulation"
                style={{
                  backgroundColor: 'var(--color-bg-surface)',
                  border: '1px solid var(--color-border-default)',
                  color: 'var(--color-text-primary)',
                  minHeight: '48px'
                }}
              >
                <CreditCard className="w-5 h-5" />
                <span className="text-sm font-medium">Transaction</span>
              </button>
              {onChatToggle && (
                <button
                  onClick={handleOpenChat}
                  className="flex items-center justify-center gap-2 p-3 rounded-lg transition-colors relative touch-manipulation"
                  style={{
                    backgroundColor: 'var(--color-bg-surface)',
                    border: '1px solid var(--color-border-default)',
                    color: 'var(--color-text-primary)',
                    minHeight: '48px'
                  }}
                >
                  <Bot className="w-5 h-5" />
                  <span className="text-sm font-medium">Isaac AI</span>
                  {unreadInsights > 0 && (
                    <span
                      className="absolute top-1 right-1 w-4 h-4 rounded-full text-xs flex items-center justify-center font-bold"
                      style={{ backgroundColor: 'var(--color-error-600)', color: 'white' }}
                    >
                      {unreadInsights > 9 ? '9+' : unreadInsights}
                    </span>
                  )}
                </button>
              )}
              {showHardRefresh && (
                <button
                  onClick={handleHardRefresh}
                  className="flex items-center justify-center gap-2 p-3 rounded-lg transition-colors touch-manipulation"
                  style={{
                    backgroundColor: 'var(--color-bg-surface)',
                    border: '1px solid var(--color-border-default)',
                    color: 'var(--color-text-primary)',
                    minHeight: '48px'
                  }}
                >
                  <RotateCcw className="w-5 h-5" />
                  <span className="text-sm font-medium">Refresh</span>
                </button>
              )}
              {feedbackEnabled && (
                <button
                  onClick={handleOpenFeedback}
                  className="flex items-center justify-center gap-2 p-3 rounded-lg transition-colors touch-manipulation"
                  style={{
                    backgroundColor: 'var(--color-bg-surface)',
                    border: '1px solid var(--color-border-default)',
                    color: 'var(--color-text-primary)',
                    minHeight: '48px'
                  }}
                >
                  <MessageSquarePlus className="w-5 h-5" />
                  <span className="text-sm font-medium">Feedback</span>
                </button>
              )}
              {showKeyboard && (
                <button
                  onClick={handleToggleKeyboard}
                  className="flex items-center justify-center gap-2 p-3 rounded-lg transition-colors touch-manipulation"
                  style={{
                    backgroundColor: 'var(--color-bg-surface)',
                    border: '1px solid var(--color-border-default)',
                    color: 'var(--color-text-primary)',
                    minHeight: '48px'
                  }}
                >
                  <Keyboard className="w-5 h-5" />
                  <span className="text-sm font-medium">Keyboard</span>
                </button>
              )}
            </div>
          </div>

          {/* Navigation Grid */}
          <nav className="flex-1 overflow-y-auto p-3">
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {navigation.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex flex-col items-center justify-center p-3 rounded-lg transition-colors touch-manipulation ${
                      isActive ? '' : 'hover:opacity-80'
                    }`
                  }
                  style={({ isActive }) => ({
                    backgroundColor: isActive ? 'var(--color-nav-item-bg-active)' : 'var(--color-bg-surface)',
                    color: isActive ? 'var(--color-nav-item-text-active)' : 'var(--color-nav-item-text)',
                    border: '1px solid var(--color-border-default)',
                    minHeight: '56px'
                  })}
                >
                  <item.icon className="w-6 h-6 mb-1" />
                  <span className="text-xs font-medium">{item.label}</span>
                </NavLink>
              ))}
            </div>
          </nav>
        </div>
      )}

      {/* Desktop: Expandable action buttons - hidden on mobile when menu is expanded (X is in header) */}
      <div ref={menuRef} className={`fixed bottom-4 right-4 md:bottom-6 md:right-6 z-[60] ${expanded ? 'hidden md:block' : ''}`}>
        {expanded && (
          <div className="hidden md:flex absolute bottom-16 right-0 flex-col gap-3 items-end">
            <button
              onClick={handleOpenQuickAdd}
              className="flex items-center gap-2 px-4 py-3 rounded-full shadow-lg transition-all hover:scale-105 touch-manipulation"
              style={{
                backgroundColor: 'var(--color-green-600)',
                border: '2px solid var(--color-green-700)',
                color: 'white'
              }}
              title="Add Event or Reminder"
            >
              <Plus className="w-5 h-5" />
              <span className="text-sm font-medium">Add</span>
            </button>
            <button
              onClick={handleOpenQuickGear}
              className="flex items-center gap-2 px-4 py-3 rounded-full shadow-lg transition-all hover:scale-105 touch-manipulation"
              style={{
                backgroundColor: 'var(--color-bg-surface)',
                border: '2px solid var(--color-border-default)',
                color: 'var(--color-text-primary)'
              }}
              title="Quick Gear Quantity"
            >
              <ShoppingBag className="w-5 h-5" />
              <span className="text-sm font-medium">Gear</span>
            </button>
            <button
              onClick={handleOpenQuickTransaction}
              className="flex items-center gap-2 px-4 py-3 rounded-full shadow-lg transition-all hover:scale-105 touch-manipulation"
              style={{
                backgroundColor: 'var(--color-bg-surface)',
                border: '2px solid var(--color-border-default)',
                color: 'var(--color-text-primary)'
              }}
              title="Add Budget Transaction"
            >
              <CreditCard className="w-5 h-5" />
              <span className="text-sm font-medium">Transaction</span>
            </button>
            {onChatToggle && (
              <button
                onClick={handleOpenChat}
                className="flex items-center gap-2 px-4 py-3 rounded-full shadow-lg transition-all hover:scale-105 touch-manipulation relative"
                style={{
                  backgroundColor: 'var(--color-bg-surface)',
                  border: '2px solid var(--color-border-default)',
                  color: 'var(--color-text-primary)'
                }}
                title="Chat with Isaac"
              >
                <Bot className="w-5 h-5" />
                <span className="text-sm font-medium">Isaac AI</span>
                {unreadInsights > 0 && (
                  <span
                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold"
                    style={{ backgroundColor: 'var(--color-error-600)', color: 'white' }}
                  >
                    {unreadInsights > 9 ? '9+' : unreadInsights}
                  </span>
                )}
              </button>
            )}
            {showHardRefresh && (
              <button
                onClick={handleHardRefresh}
                className="flex items-center gap-2 px-4 py-3 rounded-full shadow-lg transition-all hover:scale-105 touch-manipulation"
                style={{
                  backgroundColor: 'var(--color-bg-surface)',
                  border: '2px solid var(--color-border-default)',
                  color: 'var(--color-text-primary)'
                }}
                title="Hard Refresh"
              >
                <RotateCcw className="w-5 h-5" />
                <span className="text-sm font-medium">Refresh</span>
              </button>
            )}
            {feedbackEnabled && (
              <button
                onClick={handleOpenFeedback}
                className="flex items-center gap-2 px-4 py-3 rounded-full shadow-lg transition-all hover:scale-105 touch-manipulation"
                style={{
                  backgroundColor: 'var(--color-bg-surface)',
                  border: '2px solid var(--color-border-default)',
                  color: 'var(--color-text-primary)'
                }}
                title="Submit Feedback"
              >
                <MessageSquarePlus className="w-5 h-5" />
                <span className="text-sm font-medium">Feedback</span>
              </button>
            )}
            {showKeyboard && (
              <button
                onClick={handleToggleKeyboard}
                className="flex items-center gap-2 px-4 py-3 rounded-full shadow-lg transition-all hover:scale-105 touch-manipulation"
                style={{
                  backgroundColor: 'var(--color-bg-surface)',
                  border: '2px solid var(--color-border-default)',
                  color: 'var(--color-text-primary)'
                }}
                title="Toggle Keyboard"
              >
                <Keyboard className="w-5 h-5" />
                <span className="text-sm font-medium">Keyboard</span>
              </button>
            )}
          </div>
        )}

        {/* Main toggle button - 3 lines on mobile, 3 dots on desktop */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-3.5 rounded-full shadow-lg transition-all duration-200 active:scale-95 touch-manipulation"
          style={{
            backgroundColor: expanded ? 'var(--color-green-700)' : 'var(--color-nav-bg)',
            border: '2px solid var(--color-border-strong)',
            color: 'var(--color-text-inverse)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
          }}
          title={expanded ? 'Close menu' : 'Open menu'}
        >
          {expanded ? (
            <X className="w-5 h-5" />
          ) : (
            <>
              <Menu className="w-5 h-5 md:hidden" />
              <MoreVertical className="w-5 h-5 hidden md:block" />
            </>
          )}
        </button>
      </div>

      {/* Quick Add Modal */}
      {quickAddModalOpen && (
        <EventModal
          event={null}
          defaultDate={new Date()}
          onClose={handleQuickAddClose}
          onSaved={handleQuickAddSaved}
        />
      )}

      {/* Feedback Modal */}
      {feedbackModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/50">
          <div
            className="relative w-full max-w-sm sm:max-w-md rounded-xl shadow-2xl p-4 sm:p-6"
            style={{ backgroundColor: 'var(--color-bg-surface)' }}
          >
            <button
              onClick={() => setFeedbackModalOpen(false)}
              className="absolute top-4 right-4 p-1 rounded hover:bg-gray-700"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <X className="w-5 h-5" />
            </button>

            {submitted ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
                     style={{ backgroundColor: 'var(--color-success-bg)' }}>
                  <MessageSquarePlus className="w-8 h-8" style={{ color: 'var(--color-success-600)' }} />
                </div>
                <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
                  Thank You!
                </h3>
                <p style={{ color: 'var(--color-text-secondary)' }}>
                  Your feedback has been submitted.
                </p>
              </div>
            ) : (
              <>
                <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
                  Submit Feedback
                </h2>

                {error && (
                  <div className="mb-4 p-3 rounded-lg" style={{ backgroundColor: 'var(--color-error-bg)', color: 'var(--color-error-600)' }}>
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmitFeedback} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                      Type
                    </label>
                    <select
                      value={feedbackType}
                      onChange={(e) => setFeedbackType(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg"
                      style={{
                        backgroundColor: 'var(--color-input-bg)',
                        border: '1px solid var(--color-border-default)',
                        color: 'var(--color-text-primary)'
                      }}
                    >
                      <option value="feature">Feature Request</option>
                      <option value="bug">Bug Report</option>
                      <option value="improvement">Improvement</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                      Title *
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Brief summary..."
                      required
                      minLength={3}
                      className="w-full px-3 py-2 rounded-lg"
                      style={{
                        backgroundColor: 'var(--color-input-bg)',
                        border: '1px solid var(--color-border-default)',
                        color: 'var(--color-text-primary)'
                      }}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                      Description
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="More details (optional)..."
                      rows={3}
                      className="w-full px-3 py-2 rounded-lg resize-none"
                      style={{
                        backgroundColor: 'var(--color-input-bg)',
                        border: '1px solid var(--color-border-default)',
                        color: 'var(--color-text-primary)'
                      }}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                      Your Name (optional)
                    </label>
                    <input
                      type="text"
                      value={submittedBy}
                      onChange={(e) => setSubmittedBy(e.target.value)}
                      placeholder="Anonymous"
                      className="w-full px-3 py-2 rounded-lg"
                      style={{
                        backgroundColor: 'var(--color-input-bg)',
                        border: '1px solid var(--color-border-default)',
                        color: 'var(--color-text-primary)'
                      }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || title.length < 3}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors disabled:opacity-50"
                    style={{
                      backgroundColor: 'var(--color-green-600)',
                      color: 'white'
                    }}
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                    {loading ? 'Submitting...' : 'Submit Feedback'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* Quick Gear Modal */}
      {quickGearModalOpen && (
        <QuickGearModal onClose={() => setQuickGearModalOpen(false)} />
      )}

      {/* Quick Transaction Modal */}
      {quickTransactionModalOpen && (
        <QuickTransactionModal onClose={() => setQuickTransactionModalOpen(false)} />
      )}
    </>
  )
}

/**
 * Quick Gear Modal - Shows containers and their contents for quick quantity adjustment
 */
function QuickGearModal({ onClose }) {
  const [gear, setGear] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedGear, setExpandedGear] = useState({})
  const [gearContents, setGearContents] = useState({})
  const [error, setError] = useState(null)

  useEffect(() => {
    loadGear()
  }, [])

  const loadGear = async () => {
    try {
      setLoading(true)
      const res = await getTeamGear()
      // Filter to only containers (bags)
      const containers = (res.data || []).filter(g => g.is_container)
      setGear(containers)
    } catch (err) {
      setError('Failed to load gear')
    } finally {
      setLoading(false)
    }
  }

  const loadContents = async (gearItem) => {
    try {
      const res = await getGearContents(gearItem.member_id, gearItem.id)
      setGearContents(prev => ({ ...prev, [gearItem.id]: res.data || [] }))
    } catch (err) {
      console.error('Failed to load contents:', err)
    }
  }

  const toggleExpand = async (item) => {
    const isExpanding = !expandedGear[item.id]
    setExpandedGear(prev => ({ ...prev, [item.id]: isExpanding }))
    if (isExpanding && !gearContents[item.id]) {
      await loadContents(item)
    }
  }

  const handleQuantityChange = async (gearItem, content, delta) => {
    const newQty = Math.max(0, (content.quantity || 0) + delta)
    let newStatus = content.status
    if (newQty === 0) newStatus = 'MISSING'
    else if (content.min_quantity && newQty < content.min_quantity) newStatus = 'LOW'
    else if (content.status === 'MISSING' || content.status === 'LOW') newStatus = 'GOOD'

    try {
      await updateGearContents(gearItem.member_id, gearItem.id, content.id, {
        quantity: newQty,
        status: newStatus,
      })
      await loadContents(gearItem)
    } catch (err) {
      console.error('Failed to update quantity:', err)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 bg-black/50" onClick={onClose}>
      <div
        className="relative w-full max-w-md max-h-[80vh] rounded-xl shadow-2xl overflow-hidden flex flex-col"
        style={{ backgroundColor: 'var(--color-bg-surface)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--color-border-default)' }}>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Quick Gear Quantity
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-700">
            <X className="w-5 h-5" style={{ color: 'var(--color-text-muted)' }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--accent-primary)' }} />
            </div>
          ) : error ? (
            <div className="text-center py-8" style={{ color: 'var(--color-error-600)' }}>{error}</div>
          ) : gear.length === 0 ? (
            <div className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>
              No containers (bags) found. Add containers in Team {'>'} Gear.
            </div>
          ) : (
            <div className="space-y-2">
              {gear.map(item => (
                <div key={item.id} className="rounded-lg" style={{ backgroundColor: 'var(--color-bg-app)', border: '1px solid var(--color-border-default)' }}>
                  <button
                    onClick={() => toggleExpand(item)}
                    className="w-full flex items-center justify-between p-3 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <ShoppingBag className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                      <span style={{ color: 'var(--color-text-primary)' }}>{item.name}</span>
                      {item.member?.nickname && (
                        <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-muted)' }}>
                          {item.member.nickname}
                        </span>
                      )}
                    </div>
                    {expandedGear[item.id] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>

                  {expandedGear[item.id] && (
                    <div className="px-3 pb-3 space-y-2">
                      {!gearContents[item.id] ? (
                        <div className="text-center py-2">
                          <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                        </div>
                      ) : gearContents[item.id].length === 0 ? (
                        <div className="text-sm text-center py-2" style={{ color: 'var(--color-text-muted)' }}>
                          No contents
                        </div>
                      ) : (
                        gearContents[item.id].map(content => (
                          <div key={content.id} className="flex items-center justify-between p-2 rounded" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
                            <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>{content.item_name}</span>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleQuantityChange(item, content, -1)}
                                className="p-1.5 rounded transition-colors"
                                style={{ backgroundColor: 'var(--color-bg-app)' }}
                              >
                                <Minus className="w-4 h-4" />
                              </button>
                              <span className="min-w-[2rem] text-center font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                {content.quantity}
                              </span>
                              <button
                                onClick={() => handleQuantityChange(item, content, 1)}
                                className="p-1.5 rounded transition-colors"
                                style={{ backgroundColor: 'var(--color-bg-app)' }}
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Quick Transaction Modal - Add a budget transaction quickly
 */
function QuickTransactionModal({ onClose }) {
  const [categories, setCategories] = useState([])
  const [accounts, setAccounts] = useState([])
  const [defaultAccountId, setDefaultAccountId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [formData, setFormData] = useState({
    category_id: '',
    amount: '',
    description: '',
    transaction_date: new Date().toISOString().split('T')[0],
    transaction_type: 'expense'
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [catRes, acctRes] = await Promise.all([
        getBudgetCategories(),
        getBudgetAccounts()
      ])
      setCategories(catRes.data || [])
      const accts = acctRes.data || []
      setAccounts(accts)
      // Default to Money Market, then first savings, then first account
      const moneyMarket = accts.find(a => a.name === 'Money Market' && a.is_active)
      const savings = accts.find(a => a.account_type === 'savings' && a.is_active)
      const firstActive = accts.find(a => a.is_active)
      const defaultAcct = moneyMarket || savings || firstActive || accts[0]
      if (defaultAcct) setDefaultAccountId(defaultAcct.id)
    } catch (err) {
      setError('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.category_id || !formData.amount || !defaultAccountId) return

    setSaving(true)
    setError(null)
    try {
      // Get category name for default description
      const selectedCategory = categories.find(c => c.id === parseInt(formData.category_id))
      const description = formData.description.trim() || selectedCategory?.name || 'Quick transaction'

      await createBudgetTransaction({
        account_id: defaultAccountId,
        category_id: parseInt(formData.category_id),
        amount: parseFloat(formData.amount),
        description: description,
        transaction_date: formData.transaction_date,
        transaction_type: formData.transaction_type
      })
      setSuccess(true)
      setTimeout(() => onClose(), 1500)
    } catch (err) {
      setError(err.userMessage || 'Failed to add transaction')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 bg-black/50" onClick={onClose}>
      <div
        className="relative w-full max-w-sm rounded-xl shadow-2xl p-4"
        style={{ backgroundColor: 'var(--color-bg-surface)' }}
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 p-1 rounded hover:bg-gray-700">
          <X className="w-5 h-5" style={{ color: 'var(--color-text-muted)' }} />
        </button>

        {success ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--color-success-bg)' }}>
              <CreditCard className="w-8 h-8" style={{ color: 'var(--color-success-600)' }} />
            </div>
            <h3 className="text-xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>Transaction Added!</h3>
          </div>
        ) : (
          <>
            <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
              Quick Transaction
            </h2>

            {error && (
              <div className="mb-4 p-3 rounded-lg text-sm" style={{ backgroundColor: 'var(--color-error-bg)', color: 'var(--color-error-600)' }}>
                {error}
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>Type</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, transaction_type: 'expense' })}
                      className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors"
                      style={{
                        backgroundColor: formData.transaction_type === 'expense' ? 'var(--color-error-600)' : 'var(--color-bg-app)',
                        color: formData.transaction_type === 'expense' ? 'white' : 'var(--color-text-primary)',
                        border: '1px solid var(--color-border-default)'
                      }}
                    >
                      Expense
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, transaction_type: 'income' })}
                      className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors"
                      style={{
                        backgroundColor: formData.transaction_type === 'income' ? 'var(--color-success-600)' : 'var(--color-bg-app)',
                        color: formData.transaction_type === 'income' ? 'white' : 'var(--color-text-primary)',
                        border: '1px solid var(--color-border-default)'
                      }}
                    >
                      Income
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>Category *</label>
                  <select
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                    required
                    className="w-full px-3 py-2 rounded-lg"
                    style={{ backgroundColor: 'var(--color-input-bg)', border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)' }}
                  >
                    <option value="">Select category...</option>
                    {categories.filter(c => c.category_type !== 'transfer' && c.category_type !== 'fixed').map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>Amount *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                    placeholder="0.00"
                    className="w-full px-3 py-2 rounded-lg"
                    style={{ backgroundColor: 'var(--color-input-bg)', border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)' }}
                  />
                </div>

                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>Description</label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Optional..."
                    className="w-full px-3 py-2 rounded-lg"
                    style={{ backgroundColor: 'var(--color-input-bg)', border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)' }}
                  />
                </div>

                {!defaultAccountId && (
                  <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: 'var(--color-warning-bg)', color: 'var(--color-warning-600)' }}>
                    No budget accounts found. Please create an account in Budget settings first.
                  </div>
                )}

                <button
                  type="submit"
                  disabled={saving || !formData.category_id || !formData.amount || !defaultAccountId}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors disabled:opacity-50"
                  style={{ backgroundColor: 'var(--color-green-600)', color: 'white' }}
                >
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                  {saving ? 'Adding...' : 'Add Transaction'}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default FloatingActionMenu
