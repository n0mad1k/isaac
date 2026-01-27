import React, { useState, useEffect } from 'react'
import {
  Users, Plus, RefreshCw, Settings, ChevronRight, ChevronDown,
  Shield, Heart, Eye, Activity, Calendar, Target, MessageSquare,
  AlertCircle, CheckCircle, AlertTriangle, User, Trash2, Edit,
  ThumbsUp, ThumbsDown
} from 'lucide-react'
import {
  getTeamSettings, getTeamOverview, getTeamMembers, createTeamMember,
  updateTeamMember, deleteTeamMember, getTeamReadiness, createObservation,
  getWeekObservations
} from '../services/api'
import TeamOverview from '../components/team/TeamOverview'
import MemberDossier from '../components/team/MemberDossier'
import WeeklyAARView from '../components/team/WeeklyAARView'
import MemberForm from '../components/team/MemberForm'

function Team() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [settings, setSettings] = useState(null)
  const [overview, setOverview] = useState(null)
  const [members, setMembers] = useState([])
  const [activeTab, setActiveTab] = useState('overview')
  const [selectedMemberId, setSelectedMemberId] = useState(null)
  const [weekObservations, setWeekObservations] = useState([])

  // Modal states
  const [showMemberForm, setShowMemberForm] = useState(false)
  const [editingMember, setEditingMember] = useState(null)

  // Quick add observation state
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [quickAddType, setQuickAddType] = useState('went_well')
  const [quickAddMember, setQuickAddMember] = useState('')
  const [quickAddContent, setQuickAddContent] = useState('')
  const [quickAddSubmitting, setQuickAddSubmitting] = useState(false)

  // Load data
  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      const [settingsRes, overviewRes, membersRes] = await Promise.all([
        getTeamSettings(),
        getTeamOverview(),
        getTeamMembers()
      ])

      setSettings(settingsRes.data)
      setOverview(overviewRes.data)
      setMembers(membersRes.data)

      // Load this week's observations
      try {
        const today = new Date().toISOString().split('T')[0]
        const obsRes = await getWeekObservations(today)
        setWeekObservations(obsRes.data || [])
      } catch (e) {
        console.warn('Could not load observations:', e)
        setWeekObservations([])
      }

    } catch (err) {
      console.error('Failed to load team data:', err)
      setError(err.userMessage || 'Failed to load team data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

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
  const handleQuickAddSubmit = async () => {
    if (!quickAddMember || !quickAddContent.trim()) return

    setQuickAddSubmitting(true)
    try {
      await createObservation(quickAddMember, {
        observation_type: quickAddType,
        content: quickAddContent.trim(),
        scope: 'team'
      })
      setQuickAddContent('')
      setShowQuickAdd(false)
      await loadData()
    } catch (err) {
      console.error('Failed to add observation:', err)
    } finally {
      setQuickAddSubmitting(false)
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

  // Split observations by type
  const wentWellObs = weekObservations.filter(o => o.observation_type === 'went_well')
  const needsImprovementObs = weekObservations.filter(o => o.observation_type === 'needs_improvement')

  return (
    <div className="space-y-4">
      {/* Team Header Section - Always visible */}
      <TeamOverview
        settings={settings}
        overview={overview}
        members={members}
        onMemberClick={handleMemberClick}
        onLogoUpdate={loadData}
        headerOnly={true}
      />

      {/* Tab Navigation + Actions */}
      <div className="flex items-center justify-between gap-2 border-b border-gray-700 pb-1">
        <div className="flex gap-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === 'overview'
                ? 'bg-gray-800 text-white border-b-2 border-farm-green'
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
              className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
                activeTab === 'member' && selectedMemberId === member.id
                  ? 'bg-gray-800 text-white border-b-2 border-farm-green'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              }`}
            >
              <ReadinessIndicator status={member.overall_readiness} />
              {member.nickname || member.name.split(' ')[0]}
            </button>
          ))}

          <button
            onClick={() => setActiveTab('aar')}
            className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === 'aar'
                ? 'bg-gray-800 text-white border-b-2 border-farm-green'
                : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
            }`}
          >
            Weekly AAR
          </button>
        </div>

        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={loadData}
            className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button
            onClick={() => {
              setEditingMember(null)
              setShowMemberForm(true)
            }}
            className="flex items-center gap-2 px-3 py-2 bg-farm-green text-white rounded-lg hover:bg-green-600"
          >
            <Plus className="w-4 h-4" />
            Add Member
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-gray-800 rounded-lg p-4">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Weekly Observations Tracker */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-farm-green" />
                  This Week's Observations
                </h3>
                <button
                  onClick={() => setShowQuickAdd(true)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-farm-green text-white rounded-lg hover:bg-green-600 text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Quick Add
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* What Went Well */}
                <div className="bg-green-900/20 border border-green-700/50 rounded-lg p-4">
                  <h4 className="font-medium text-green-400 flex items-center gap-2 mb-3">
                    <ThumbsUp className="w-4 h-4" />
                    What Went Well
                  </h4>
                  {wentWellObs.length === 0 ? (
                    <p className="text-gray-500 text-sm italic">No entries this week</p>
                  ) : (
                    <ul className="space-y-2">
                      {wentWellObs.map((obs, idx) => (
                        <li key={idx} className="text-sm">
                          <span className="text-gray-400">{obs.member_name}:</span>{' '}
                          <span className="text-gray-200">{obs.content}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Needs Improvement */}
                <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-4">
                  <h4 className="font-medium text-red-400 flex items-center gap-2 mb-3">
                    <ThumbsDown className="w-4 h-4" />
                    Needs Improvement
                  </h4>
                  {needsImprovementObs.length === 0 ? (
                    <p className="text-gray-500 text-sm italic">No entries this week</p>
                  ) : (
                    <ul className="space-y-2">
                      {needsImprovementObs.map((obs, idx) => (
                        <li key={idx} className="text-sm">
                          <span className="text-gray-400">{obs.member_name}:</span>{' '}
                          <span className="text-gray-200">{obs.content}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>

            {/* Team Roster */}
            <TeamOverview
              settings={settings}
              overview={overview}
              members={members}
              onMemberClick={handleMemberClick}
              onLogoUpdate={loadData}
              rosterOnly={true}
            />
          </div>
        )}

        {activeTab === 'member' && selectedMember && (
          <MemberDossier
            member={selectedMember}
            settings={settings}
            onEdit={() => {
              setEditingMember(selectedMember)
              setShowMemberForm(true)
            }}
            onDelete={() => handleDeleteMember(selectedMember.id)}
            onUpdate={loadData}
          />
        )}

        {activeTab === 'aar' && (
          <WeeklyAARView
            settings={settings}
            members={members}
          />
        )}
      </div>

      {/* Quick Add Observation Modal */}
      {showQuickAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Add Observation</h3>

            {/* Type Selection */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setQuickAddType('went_well')}
                className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors ${
                  quickAddType === 'went_well'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                }`}
              >
                <ThumbsUp className="w-4 h-4" />
                Went Well
              </button>
              <button
                onClick={() => setQuickAddType('needs_improvement')}
                className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors ${
                  quickAddType === 'needs_improvement'
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                }`}
              >
                <ThumbsDown className="w-4 h-4" />
                Needs Improvement
              </button>
            </div>

            {/* Member Selection */}
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-1">Who are you?</label>
              <select
                value={quickAddMember}
                onChange={(e) => setQuickAddMember(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              >
                <option value="">Select member...</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.nickname || m.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Content */}
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-1">
                {quickAddType === 'went_well' ? 'What went well?' : 'What needs improvement?'}
              </label>
              <textarea
                value={quickAddContent}
                onChange={(e) => setQuickAddContent(e.target.value)}
                placeholder="Enter your observation..."
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white resize-none"
                rows={3}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowQuickAdd(false)
                  setQuickAddContent('')
                }}
                className="px-4 py-2 text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleQuickAddSubmit}
                disabled={!quickAddMember || !quickAddContent.trim() || quickAddSubmitting}
                className="px-4 py-2 bg-farm-green text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {quickAddSubmitting ? 'Adding...' : 'Add'}
              </button>
            </div>
          </div>
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
    </div>
  )
}

export default Team
