import React, { useState, useEffect, useRef } from 'react'
import {
  Users, Plus, RefreshCw, Shield, AlertCircle, User, ChevronLeft, ChevronRight,
  ChevronDown, UserPlus, MessageSquare, Calendar, ThumbsUp, ThumbsDown, Settings,
  ClipboardCheck, Dumbbell, Heart, Scale
} from 'lucide-react'
import {
  getTeamSettings, getTeamOverview, getTeamMembers, createTeamMember,
  updateTeamMember, deleteTeamMember, createObservation, createMentoringSession,
  logWeight
} from '../services/api'
import TeamOverview from '../components/team/TeamOverview'
import MemberDossier from '../components/team/MemberDossier'
import WeeklyAARView from '../components/team/WeeklyAARView'
import MemberForm from '../components/team/MemberForm'
import TeamGearTab from '../components/team/TeamGearTab'
import TeamSupplyRequestsTab from '../components/team/TeamSupplyRequestsTab'
import DailyCheckinModal from '../components/team/DailyCheckinModal'
import QuickAddWorkout from '../components/team/QuickAddWorkout'
import QuickAddVital from '../components/team/QuickAddVital'

function Team() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [settings, setSettings] = useState(null)
  const [overview, setOverview] = useState(null)
  const [members, setMembers] = useState([])
  const [activeTab, setActiveTab] = useState('overview')
  const [selectedMemberId, setSelectedMemberId] = useState(null)

  // Modal states
  const [showMemberForm, setShowMemberForm] = useState(false)
  const [editingMember, setEditingMember] = useState(null)
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [showObservationModal, setShowObservationModal] = useState(false)
  const [showSessionModal, setShowSessionModal] = useState(false)

  // Quick add observation state
  const [obsType, setObsType] = useState('went_well')
  const [obsMember, setObsMember] = useState('')
  const [obsContent, setObsContent] = useState('')
  const [obsScope, setObsScope] = useState('team')
  const [obsSubmitting, setObsSubmitting] = useState(false)

  // Quick add session state
  const [sessionMember, setSessionMember] = useState('')
  const [sessionSubmitting, setSessionSubmitting] = useState(false)

  // Quick Add FAB modal states
  const [showDailyCheckin, setShowDailyCheckin] = useState(false)
  const [showQuickWorkout, setShowQuickWorkout] = useState(false)
  const [showQuickVital, setShowQuickVital] = useState(false)
  const [showQuickWeight, setShowQuickWeight] = useState(false)
  const [quickWeightMemberId, setQuickWeightMemberId] = useState('')
  const [quickWeightValue, setQuickWeightValue] = useState('')
  const [quickWeightSubmitting, setQuickWeightSubmitting] = useState(false)

  // Tab navigation state
  const tabsRef = useRef(null)
  const [showLeftArrow, setShowLeftArrow] = useState(false)
  const [showRightArrow, setShowRightArrow] = useState(false)

  // Load data - silent=true skips the loading spinner (used by child component refreshes)
  const loadData = async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      setError(null)

      const [settingsRes, overviewRes, membersRes] = await Promise.all([
        getTeamSettings(),
        getTeamOverview(),
        getTeamMembers()
      ])

      setSettings(settingsRes.data)
      setOverview(overviewRes.data)
      setMembers(membersRes.data)

    } catch (err) {
      console.error('Failed to load team data:', err)
      setError(err.userMessage || 'Failed to load team data')
    } finally {
      if (!silent) setLoading(false)
    }
  }

  // Silent refresh for child components (doesn't unmount/remount components)
  const silentRefresh = () => loadData(true)

  useEffect(() => {
    loadData()
  }, [])

  // Check if tabs overflow and need arrows
  const checkTabsOverflow = () => {
    if (tabsRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = tabsRef.current
      setShowLeftArrow(scrollLeft > 0)
      setShowRightArrow(scrollLeft + clientWidth < scrollWidth - 1)
    }
  }

  useEffect(() => {
    checkTabsOverflow()
    window.addEventListener('resize', checkTabsOverflow)
    return () => window.removeEventListener('resize', checkTabsOverflow)
  }, [members])

  const scrollTabs = (direction) => {
    if (tabsRef.current) {
      const scrollAmount = 150
      tabsRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      })
      setTimeout(checkTabsOverflow, 300)
    }
  }

  // Handle member tab click
  const handleMemberClick = (memberId) => {
    setSelectedMemberId(memberId)
    setActiveTab('member')
  }

  // Handle create member
  const handleCreateMember = async (data) => {
    try {
      await createTeamMember(data)
      await loadData()
      setShowMemberForm(false)
    } catch (err) {
      console.error('Failed to create member:', err)
      throw err
    }
  }

  // Handle update member
  const handleUpdateMember = async (data) => {
    try {
      await updateTeamMember(editingMember.id, data)
      await loadData()
      setEditingMember(null)
      setShowMemberForm(false)
    } catch (err) {
      console.error('Failed to update member:', err)
      throw err
    }
  }

  // Handle delete member
  const handleDeleteMember = async (memberId) => {
    if (!confirm('Are you sure you want to delete this member? This cannot be undone.')) {
      return
    }
    try {
      await deleteTeamMember(memberId)
      if (selectedMemberId === memberId) {
        setSelectedMemberId(null)
        setActiveTab('overview')
      }
      await loadData()
    } catch (err) {
      console.error('Failed to delete member:', err)
    }
  }

  // Handle quick add observation
  const handleAddObservation = async () => {
    if (!obsMember || !obsContent.trim()) return
    setObsSubmitting(true)
    try {
      await createObservation(obsMember, {
        observation_type: obsType,
        content: obsContent.trim(),
        scope: obsScope
      })
      setObsContent('')
      setShowObservationModal(false)
      await loadData()
    } catch (err) {
      console.error('Failed to add observation:', err)
    } finally {
      setObsSubmitting(false)
    }
  }

  // Handle quick add session
  const handleAddSession = async () => {
    if (!sessionMember) return
    setSessionSubmitting(true)
    try {
      await createMentoringSession(sessionMember, {})
      setShowSessionModal(false)
      // Navigate to that member's tab
      setSelectedMemberId(parseInt(sessionMember))
      setActiveTab('member')
      await loadData()
    } catch (err) {
      console.error('Failed to create session:', err)
    } finally {
      setSessionSubmitting(false)
    }
  }

  // Readiness indicator component
  const ReadinessIndicator = ({ status, size = 'sm' }) => {
    const colors = {
      GREEN: 'bg-green-500',
      AMBER: 'bg-yellow-500',
      RED: 'bg-red-500'
    }
    const sizes = {
      sm: 'w-3 h-3',
      md: 'w-4 h-4',
      lg: 'w-5 h-5'
    }
    return (
      <span
        className={`inline-block rounded-full ${colors[status] || 'bg-gray-500'} ${sizes[size]}`}
        title={status}
      />
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-farm-green" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-red-200">
        <AlertCircle className="w-5 h-5 inline mr-2" />
        {error}
        <button onClick={loadData} className="ml-4 text-sm underline">
          Retry
        </button>
      </div>
    )
  }

  const selectedMember = members.find(m => m.id === selectedMemberId)

  return (
    <div className="space-y-4">
      {/* Header Row: Tabs (left) + Team Name (center) + Actions (right) */}
      <div className="relative flex items-center border-b border-gray-700 pb-2">
        {/* Team Name - Absolutely centered */}
        <h1 className="absolute left-1/2 -translate-x-1/2 text-2xl font-bold text-white pointer-events-none">
          {settings?.team_name || 'Team'}
        </h1>

        {/* Tab Navigation - Left */}
        <div className="flex items-center gap-1 flex-shrink-0 max-w-[50%] sm:max-w-[35%]">
          {showLeftArrow && (
            <button
              onClick={() => scrollTabs('left')}
              className="p-1 text-gray-400 hover:text-white"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
          <div
            ref={tabsRef}
            onScroll={checkTabsOverflow}
            className="flex gap-1 overflow-x-auto sm:overflow-x-hidden scrollbar-hide"
          >
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === 'overview'
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              }`}
            >
              Overview
            </button>

            {/* Member tabs */}
            {members.map(member => (
              <button
                key={member.id}
                onClick={() => handleMemberClick(member.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === 'member' && selectedMemberId === member.id
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                }`}
              >
                <ReadinessIndicator status={member.overall_readiness} />
                {member.nickname || member.name.split(' ')[0]}
              </button>
            ))}

            <button
              onClick={() => setActiveTab('gear')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === 'gear'
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              }`}
            >
              Gear
            </button>

            <button
              onClick={() => setActiveTab('supplies')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === 'supplies'
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              }`}
            >
              Supplies
            </button>

            <button
              onClick={() => setActiveTab('aar')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === 'aar'
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              }`}
            >
              Weekly AAR
            </button>
          </div>
          {showRightArrow && (
            <button
              onClick={() => scrollTabs('right')}
              className="p-1 text-gray-400 hover:text-white"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Spacer to push actions to right */}
        <div className="flex-1"></div>

        {/* Actions - Right */}
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={loadData}
            className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </button>

          {/* Add Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowAddMenu(!showAddMenu)}
              className="flex items-center gap-2 px-3 py-2 bg-farm-green text-white rounded-lg hover:bg-green-600"
            >
              <Plus className="w-4 h-4" />
              Add
              <ChevronDown className="w-4 h-4" />
            </button>

            {showAddMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowAddMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-56 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50 overflow-hidden">
                  {/* Health Data Entry */}
                  <div className="px-3 py-2 text-xs text-gray-500 uppercase border-b border-gray-700">Health Data</div>
                  <button
                    onClick={() => {
                      setShowAddMenu(false)
                      setShowDailyCheckin(true)
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700 flex items-center gap-3"
                  >
                    <ClipboardCheck className="w-4 h-4 text-blue-400" />
                    Daily Check-in
                  </button>
                  <button
                    onClick={() => {
                      setShowAddMenu(false)
                      setShowQuickWorkout(true)
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700 flex items-center gap-3"
                  >
                    <Dumbbell className="w-4 h-4 text-green-400" />
                    Log Workout
                  </button>
                  <button
                    onClick={() => {
                      setShowAddMenu(false)
                      setShowQuickVital(true)
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700 flex items-center gap-3"
                  >
                    <Heart className="w-4 h-4 text-red-400" />
                    Log Vital
                  </button>
                  <button
                    onClick={() => {
                      setShowAddMenu(false)
                      setShowQuickWeight(true)
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700 flex items-center gap-3"
                  >
                    <Scale className="w-4 h-4 text-purple-400" />
                    Log Weight
                  </button>

                  {/* Team Management */}
                  <div className="px-3 py-2 text-xs text-gray-500 uppercase border-b border-t border-gray-700 mt-1">Team</div>
                  <button
                    onClick={() => {
                      setShowAddMenu(false)
                      setEditingMember(null)
                      setShowMemberForm(true)
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700 flex items-center gap-3"
                  >
                    <UserPlus className="w-4 h-4 text-farm-green" />
                    Add Member
                  </button>
                  <button
                    onClick={() => {
                      setShowAddMenu(false)
                      setShowObservationModal(true)
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700 flex items-center gap-3"
                  >
                    <MessageSquare className="w-4 h-4 text-blue-400" />
                    Add Observation
                  </button>
                  <button
                    onClick={() => {
                      setShowAddMenu(false)
                      setShowSessionModal(true)
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700 flex items-center gap-3"
                  >
                    <Calendar className="w-4 h-4 text-purple-400" />
                    Add Session
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Overview Tab - Landing page with mission/logo/values (no team name since it's in header) */}
      {activeTab === 'overview' && (
        <TeamOverview
          settings={settings}
          overview={overview}
          members={members}
          onMemberClick={handleMemberClick}
          onLogoUpdate={loadData}
          headerOnly={true}
          hideTeamName={true}
        />
      )}

      {/* Tab Content - Only shown for non-overview tabs */}
      {activeTab !== 'overview' && (
        <div className="bg-gray-800 rounded-lg p-4">
          {activeTab === 'member' && selectedMember && (
            <MemberDossier
              member={selectedMember}
              settings={settings}
              onEdit={() => {
                setEditingMember(selectedMember)
                setShowMemberForm(true)
              }}
              onDelete={() => handleDeleteMember(selectedMember.id)}
              onUpdate={silentRefresh}
            />
          )}

          {activeTab === 'aar' && (
            <WeeklyAARView
              settings={settings}
              members={members}
            />
          )}

          {activeTab === 'gear' && (
            <TeamGearTab
              members={members}
              onRefresh={loadData}
            />
          )}

          {activeTab === 'supplies' && (
            <TeamSupplyRequestsTab
              members={members}
            />
          )}
        </div>
      )}

      {/* Member Form Modal */}
      {showMemberForm && (
        <MemberForm
          member={editingMember}
          settings={settings}
          onSubmit={editingMember ? handleUpdateMember : handleCreateMember}
          onClose={() => {
            setShowMemberForm(false)
            setEditingMember(null)
          }}
        />
      )}

      {/* Quick Add Observation Modal */}
      {showObservationModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-4 sm:p-6 w-full max-w-[92vw] sm:max-w-md">
            <h3 className="text-lg font-semibold mb-4">Add Observation</h3>

            <div className="space-y-4">
              {/* Member Selection */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Team Member</label>
                <select
                  value={obsMember}
                  onChange={(e) => setObsMember(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                >
                  <option value="">Select member...</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.nickname || m.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Observation Type */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Type</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setObsType('went_well')}
                    className={`flex-1 px-3 py-2 rounded flex items-center justify-center gap-2 ${
                      obsType === 'went_well'
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    <ThumbsUp className="w-4 h-4" />
                    Went Well
                  </button>
                  <button
                    type="button"
                    onClick={() => setObsType('needs_improvement')}
                    className={`flex-1 px-3 py-2 rounded flex items-center justify-center gap-2 ${
                      obsType === 'needs_improvement'
                        ? 'bg-amber-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    <ThumbsDown className="w-4 h-4" />
                    Needs Work
                  </button>
                </div>
              </div>

              {/* Scope */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Scope</label>
                <select
                  value={obsScope}
                  onChange={(e) => setObsScope(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                >
                  <option value="individual">Individual</option>
                  <option value="team">Team</option>
                  <option value="operations">Operations</option>
                </select>
              </div>

              {/* Content */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Observation</label>
                <textarea
                  value={obsContent}
                  onChange={(e) => setObsContent(e.target.value)}
                  placeholder="What happened..."
                  rows={3}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setShowObservationModal(false)
                  setObsContent('')
                  setObsMember('')
                }}
                className="px-4 py-2 text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleAddObservation}
                disabled={obsSubmitting || !obsMember || !obsContent.trim()}
                className="px-4 py-2 bg-farm-green text-white rounded hover:bg-green-600 disabled:opacity-50"
              >
                {obsSubmitting ? 'Adding...' : 'Add Observation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Session Modal */}
      {showSessionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-4 sm:p-6 w-full max-w-[92vw] sm:max-w-md">
            <h3 className="text-lg font-semibold mb-4">Start Mentoring Session</h3>

            <div className="space-y-4">
              {/* Member Selection */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Team Member</label>
                <select
                  value={sessionMember}
                  onChange={(e) => setSessionMember(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                >
                  <option value="">Select member...</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.nickname || m.name}
                    </option>
                  ))}
                </select>
              </div>

              <p className="text-sm text-gray-400">
                This will create a new mentoring session for the selected member and navigate to their profile.
              </p>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setShowSessionModal(false)
                  setSessionMember('')
                }}
                className="px-4 py-2 text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleAddSession}
                disabled={sessionSubmitting || !sessionMember}
                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-500 disabled:opacity-50"
              >
                {sessionSubmitting ? 'Creating...' : 'Start Session'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Weight Modal */}
      {showQuickWeight && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-4 sm:p-6 w-full max-w-[92vw] sm:max-w-md">
            <h3 className="text-lg font-semibold mb-4">Log Weight</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Team Member</label>
                <select
                  value={quickWeightMemberId}
                  onChange={(e) => setQuickWeightMemberId(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                >
                  <option value="">Select member...</option>
                  {members.filter(m => m.is_active !== false).map(m => (
                    <option key={m.id} value={m.id}>
                      {m.nickname || m.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Weight (lbs)</label>
                <input
                  type="number"
                  step="0.1"
                  value={quickWeightValue}
                  onChange={(e) => setQuickWeightValue(e.target.value)}
                  placeholder="170"
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setShowQuickWeight(false)
                  setQuickWeightMemberId('')
                  setQuickWeightValue('')
                }}
                className="px-4 py-2 text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!quickWeightMemberId || !quickWeightValue) return
                  setQuickWeightSubmitting(true)
                  try {
                    await logWeight(quickWeightMemberId, { weight: parseFloat(quickWeightValue) })
                    setShowQuickWeight(false)
                    setQuickWeightMemberId('')
                    setQuickWeightValue('')
                    await loadData()
                  } catch (err) {
                    console.error('Failed to log weight:', err)
                  } finally {
                    setQuickWeightSubmitting(false)
                  }
                }}
                disabled={quickWeightSubmitting || !quickWeightMemberId || !quickWeightValue}
                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-500 disabled:opacity-50"
              >
                {quickWeightSubmitting ? 'Saving...' : 'Log Weight'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Daily Check-in Modal */}
      {showDailyCheckin && (
        <DailyCheckinModal
          members={members}
          onClose={() => setShowDailyCheckin(false)}
          onSuccess={loadData}
        />
      )}

      {/* Quick Add Workout Modal */}
      {showQuickWorkout && (
        <QuickAddWorkout
          members={members}
          onClose={() => setShowQuickWorkout(false)}
          onSuccess={loadData}
        />
      )}

      {/* Quick Add Vital Modal */}
      {showQuickVital && (
        <QuickAddVital
          members={members}
          onClose={() => setShowQuickVital(false)}
          onSuccess={loadData}
        />
      )}

    </div>
  )
}

export default Team
