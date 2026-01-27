import React, { useRef } from 'react'
import {
  Users, Shield, Heart, Activity, Calendar, Target,
  ChevronRight, Upload, Image
} from 'lucide-react'
import { uploadTeamLogo } from '../../services/api'

function TeamOverview({ settings, overview, members, onMemberClick, onLogoUpdate, headerOnly = false, rosterOnly = false, hideTeamName = false }) {
  const logoInputRef = useRef(null)

  // Handle logo upload
  const handleLogoUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)

    try {
      await uploadTeamLogo(formData)
      if (onLogoUpdate) onLogoUpdate()
    } catch (err) {
      console.error('Failed to upload logo:', err)
    }
  }

  // Readiness indicator component
  const ReadinessIndicator = ({ status, size = 'md' }) => {
    const colors = {
      GREEN: 'bg-green-500',
      AMBER: 'bg-yellow-500',
      RED: 'bg-red-500'
    }
    const sizes = {
      sm: 'w-3 h-3',
      md: 'w-4 h-4',
      lg: 'w-6 h-6'
    }
    return (
      <span
        className={`inline-block rounded-full ${colors[status] || 'bg-gray-500'} ${sizes[size]}`}
        title={status}
      />
    )
  }

  // Header Only Mode - just team name, mission, logo, values
  if (headerOnly) {
    return (
      <div className="text-center space-y-3 py-2">
        {/* Team Name - only show if not hidden */}
        {!hideTeamName && settings?.team_name && (
          <h1 className="text-3xl font-bold text-white tracking-wide">
            {settings.team_name}
          </h1>
        )}

        {/* Mission Statement - Larger */}
        {settings?.team_mission && (
          <div className="max-w-4xl mx-auto px-4">
            <p className="text-xl text-gray-200 leading-relaxed italic font-light">
              "{settings.team_mission}"
            </p>
          </div>
        )}

        {/* Team Logo - Larger */}
        <div className="flex justify-center py-2">
          {settings?.team_logo ? (
            <div className="relative group">
              <img
                src={`/api/team/logo/${settings.team_logo.split('/').pop()}`}
                alt="Team Logo"
                className="max-h-80 max-w-2xl object-contain drop-shadow-2xl"
              />
              <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity rounded">
                <span className="text-white text-sm flex items-center gap-2">
                  <Upload className="w-4 h-4" /> Change Logo
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                  ref={logoInputRef}
                />
              </label>
            </div>
          ) : (
            <label className="cursor-pointer">
              <div className="w-56 h-44 border-2 border-dashed border-gray-600 rounded-lg flex flex-col items-center justify-center text-gray-500 hover:border-gray-500 hover:text-gray-400 transition-colors">
                <Image className="w-14 h-14 mb-2" />
                <span className="text-sm">Upload Team Logo</span>
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
                ref={logoInputRef}
              />
            </label>
          )}
        </div>

        {/* Core Values - Compact */}
        {settings?.team_values && settings.team_values.length > 0 && (
          <div className="pt-1">
            <h2 className="text-lg font-bold mb-3">
              Core Values
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 max-w-5xl mx-auto px-4">
              {settings.team_values.map((value, idx) => (
                <div
                  key={idx}
                  className="bg-gray-700 rounded-lg p-2.5 border-l-4 border-farm-green"
                >
                  <h3 className="text-sm font-bold text-white mb-0.5">{value.name}</h3>
                  <p className="text-xs text-gray-300 line-clamp-2">{value.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // Roster Only Mode - just team roster and appointments
  if (rosterOnly) {
    return (
      <div className="space-y-6">
        {/* Team Roster */}
        {members.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Users className="w-5 h-5 text-farm-green" />
              Team Roster ({overview?.active_members || members.length} Active)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {members.map(member => (
                <button
                  key={member.id}
                  onClick={() => onMemberClick(member.id)}
                  className="bg-gray-700 rounded-lg p-4 text-left hover:bg-gray-600 transition-colors flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    {member.photo_path ? (
                      <img
                        src={`/api/team/photos/${member.photo_path.split('/').pop()}`}
                        alt={member.name}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gray-600 flex items-center justify-center text-gray-400">
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        {member.nickname || member.name}
                        <ReadinessIndicator status={member.overall_readiness} size="sm" />
                      </div>
                      <div className="text-sm text-gray-400">
                        {member.role_title || member.role}
                        {member.callsign && ` · "${member.callsign}"`}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-white transition-colors" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming Appointments */}
        {overview?.upcoming_appointments && overview.upcoming_appointments.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-farm-green" />
              Upcoming Appointments (Next 30 Days)
            </h3>
            <div className="bg-gray-700 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-600">
                    <th className="text-left p-3 text-sm font-medium text-gray-400">Member</th>
                    <th className="text-left p-3 text-sm font-medium text-gray-400">Type</th>
                    <th className="text-left p-3 text-sm font-medium text-gray-400">Due Date</th>
                    <th className="text-left p-3 text-sm font-medium text-gray-400">Days Until</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.upcoming_appointments.map((apt, idx) => (
                    <tr key={idx} className="border-b border-gray-600 last:border-0">
                      <td className="p-3">{apt.member_name}</td>
                      <td className="p-3">{apt.type}</td>
                      <td className="p-3 text-gray-400">
                        {new Date(apt.due_date).toLocaleDateString()}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded text-xs ${
                          apt.days_until <= 7
                            ? 'bg-red-900/50 text-red-300'
                            : apt.days_until <= 14
                              ? 'bg-yellow-900/50 text-yellow-300'
                              : 'bg-gray-600 text-gray-300'
                        }`}>
                          {apt.days_until === 0 ? 'Today' : `${apt.days_until} days`}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Full mode (legacy - not used with new layout)
  return (
    <div className="space-y-8">
      {/* Cover Letter Style Header */}
      <div className="text-center space-y-6 py-6">
        {/* Team Name */}
        {settings?.team_name && (
          <h1 className="text-4xl font-bold text-white tracking-wide">
            {settings.team_name}
          </h1>
        )}

        {/* Mission Statement */}
        {settings?.team_mission && (
          <div className="max-w-3xl mx-auto">
            <p className="text-lg text-gray-200 leading-relaxed font-light italic">
              "{settings.team_mission}"
            </p>
          </div>
        )}

        {/* Team Logo */}
        <div className="flex justify-center py-8">
          {settings?.team_logo ? (
            <div className="relative group">
              <img
                src={`/api/team/logo/${settings.team_logo.split('/').pop()}`}
                alt="Team Logo"
                className="max-h-96 max-w-2xl object-contain drop-shadow-2xl"
              />
              <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity rounded">
                <span className="text-white text-sm flex items-center gap-2">
                  <Upload className="w-4 h-4" /> Change Logo
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                  ref={logoInputRef}
                />
              </label>
            </div>
          ) : (
            <label className="cursor-pointer">
              <div className="w-64 h-48 border-2 border-dashed border-gray-600 rounded-lg flex flex-col items-center justify-center text-gray-500 hover:border-gray-500 hover:text-gray-400 transition-colors">
                <Image className="w-16 h-16 mb-3" />
                <span className="text-lg">Upload Team Logo</span>
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
                ref={logoInputRef}
              />
            </label>
          )}
        </div>

        {/* Core Values */}
        {settings?.team_values && settings.team_values.length > 0 && (
          <div className="pt-4">
            <h2 className="text-xl font-bold mb-6 flex items-center justify-center gap-2">
              <Target className="w-6 h-6 text-farm-green" />
              Core Values
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
              {settings.team_values.map((value, idx) => (
                <div
                  key={idx}
                  className="bg-gray-700 rounded-lg p-4 border-l-4 border-farm-green"
                >
                  <h3 className="text-lg font-bold text-white mb-1">{value.name}</h3>
                  <p className="text-sm text-gray-300">{value.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-gray-700"></div>

      {/* Team Roster */}
      {members.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Users className="w-5 h-5 text-farm-green" />
            Team Roster ({overview?.active_members || members.length} Active)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {members.map(member => (
              <button
                key={member.id}
                onClick={() => onMemberClick(member.id)}
                className="bg-gray-700 rounded-lg p-4 text-left hover:bg-gray-600 transition-colors flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  {member.photo_path ? (
                    <img
                      src={`/api/team/photos/${member.photo_path.split('/').pop()}`}
                      alt={member.name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gray-600 flex items-center justify-center text-gray-400">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {member.nickname || member.name}
                      <ReadinessIndicator status={member.overall_readiness} size="sm" />
                    </div>
                    <div className="text-sm text-gray-400">
                      {member.role_title || member.role}
                      {member.callsign && ` · "${member.callsign}"`}
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-white transition-colors" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Appointments */}
      {overview?.upcoming_appointments && overview.upcoming_appointments.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-farm-green" />
            Upcoming Appointments (Next 30 Days)
          </h3>
          <div className="bg-gray-700 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-600">
                  <th className="text-left p-3 text-sm font-medium text-gray-400">Member</th>
                  <th className="text-left p-3 text-sm font-medium text-gray-400">Type</th>
                  <th className="text-left p-3 text-sm font-medium text-gray-400">Due Date</th>
                  <th className="text-left p-3 text-sm font-medium text-gray-400">Days Until</th>
                </tr>
              </thead>
              <tbody>
                {overview.upcoming_appointments.map((apt, idx) => (
                  <tr key={idx} className="border-b border-gray-600 last:border-0">
                    <td className="p-3">{apt.member_name}</td>
                    <td className="p-3">{apt.type}</td>
                    <td className="p-3 text-gray-400">
                      {new Date(apt.due_date).toLocaleDateString()}
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs ${
                        apt.days_until <= 7
                          ? 'bg-red-900/50 text-red-300'
                          : apt.days_until <= 14
                            ? 'bg-yellow-900/50 text-yellow-300'
                            : 'bg-gray-600 text-gray-300'
                      }`}>
                        {apt.days_until === 0 ? 'Today' : `${apt.days_until} days`}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default TeamOverview
