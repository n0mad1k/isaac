import React, { useState, useEffect } from 'react'
import {
  Users, Plus, RefreshCw, Shield, AlertCircle, User
} from 'lucide-react'
import {
  getTeamSettings, getTeamOverview, getTeamMembers, createTeamMember,
  updateTeamMember, deleteTeamMember
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

  // Modal states
  const [showMemberForm, setShowMemberForm] = useState(false)
  const [editingMember, setEditingMember] = useState(null)

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
      {/* Overview Tab - Landing page with mission/logo/values */}
      {activeTab === 'overview' && (
        <TeamOverview
          settings={settings}
          overview={overview}
          members={members}
          onMemberClick={handleMemberClick}
          onLogoUpdate={loadData}
          headerOnly={true}
        />
      )}

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
