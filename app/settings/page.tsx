'use client'

// Built against PRD Section 8.8 (Settings & Privacy Controls)
import React, { useState, useEffect } from 'react'
import { User, LogOut, Download, Trash2, X, Loader2, Award, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/Button'
import { createClient } from '@/utils/supabase/client'
import { getActivePauseAction, submitSelfReportAction, updateProfileDetailsAction } from './actions'

export default function SettingsPage() {
  const isPreview = process.env.NEXT_PUBLIC_PREVIEW_MODE === 'true' && process.env.NODE_ENV !== 'production'
  const supabase = createClient()

  // Profile states
  const [profile, setProfile] = useState({
    name: 'Fitness Coach Patient',
    phone: '+234 803 000 0000',
    email: '',
    condition: 'Hypertension',
    tier: 'Bronze'
  })
  const [showTierBadge, setShowTierBadge] = useState(false)
  
  // Action states
  const [isExporting, setIsExporting] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  // Self Report States
  const [activePause, setActivePause] = useState<any | null>(null)
  const [showReportModal, setShowReportModal] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [reportNote, setReportNote] = useState('')
  const [reportLoading, setReportLoading] = useState(false)
  const [reportSuccess, setReportSuccess] = useState(false)
  const [reportError, setReportError] = useState<string | null>(null)

  // Edit Profile States
  const [showEditModal, setShowEditModal] = useState(false)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [editSuccess, setEditSuccess] = useState(false)

  // Load user profile details
  useEffect(() => {
    if (isPreview) {
      setProfile({
        name: 'Fitness Coach Patient (Preview)',
        phone: '+234 803 000 0000',
        email: 'patient@whealthafrica.com',
        condition: localStorage.getItem('preview_condition') || 'Hypertension',
        tier: localStorage.getItem('preview_tier') || 'Bronze'
      })
      const stored = localStorage.getItem('preview_show_tier_badge')
      // If the key has never been explicitly set, default to false and persist it.
      // This prevents a test-session truthy value from masquerading as the default.
      if (stored === null) {
        localStorage.setItem('preview_show_tier_badge', 'false')
        setShowTierBadge(false)
      } else {
        setShowTierBadge(stored === 'true')
      }

      // Check preview pause
      const previewPauseStr = localStorage.getItem('preview_active_pause')
      if (previewPauseStr) {
        const previewPause = JSON.parse(previewPauseStr)
        if (new Date(previewPause.pause_ends_at) > new Date()) {
          setActivePause(previewPause)
        }
      }
      return
    }

    async function loadProfileAndPause() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: userProfile } = await supabase
        .from('users')
        .select('name, phone, show_tier_badge, tier, condition')
        .eq('id', user.id)
        .single()

      if (userProfile) {
        setProfile({
          name: userProfile.name || 'NFC Member',
          phone: userProfile.phone || user.phone || 'No phone recorded',
          email: user.email || '',
          condition: userProfile.condition || 'Hypertension',
          tier: userProfile.tier || 'Bronze'
        })
        setShowTierBadge(!!userProfile.show_tier_badge)
      }

      const res = await getActivePauseAction()
      if (res.success && res.activePause) {
        setActivePause(res.activePause)
      }
    }

    loadProfileAndPause()
  }, [isPreview])

  // Handle opt-in tier badge toggle (default off, logs telemetry)
  const handleToggleBadge = async (checked: boolean) => {
    setShowTierBadge(checked)

    if (isPreview) {
      localStorage.setItem('preview_show_tier_badge', checked.toString())
      return
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase
          .from('users')
          .update({ show_tier_badge: checked })
          .eq('id', user.id)

        // Log badge opt-in telemetry event
        await supabase
          .from('telemetry_events')
          .insert({
            user_id: user.id,
            event_type: 'badge_toggle',
            metadata: { show_tier_badge: checked }
          })
      }
    } catch (err) {
      console.error('Failed to toggle badge:', err)
    }
  }

  // Handle Interactive Sign Out
  const handleSignOut = async () => {
    if (isPreview) {
      window.location.href = '/sign-in'
      return
    }
    await supabase.auth.signOut()
    window.location.href = '/sign-in'
  }

  // NDPR Data Export (Fully functional client-side trigger)
  const handleExportData = async () => {
    setIsExporting(true)
    try {
      let exportPayload = {}

      if (isPreview) {
        // Mock data export + local storage vitals
        const savedVitals = localStorage.getItem('preview_vitals_log')
        const vitals = savedVitals ? JSON.parse(savedVitals) : []
        exportPayload = {
          app: 'Naija Fitness Coach (Lite)',
          exported_at: new Date().toISOString(),
          compliance_framework: 'NDPR (Nigeria Data Protection Regulation)',
          profile: {
            name: profile.name,
            phone: profile.phone,
            condition: 'Hypertension'
          },
          completions: [
            {
              task_id: 'ht_bp_log',
              task_type: 'loggable',
              completed_at: new Date().toISOString(),
              reflective_choice: 'Normal (<120/80)',
              low_confidence_flag: false
            }
          ],
          vitals_history: vitals
        }
      } else {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: userProfile } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single()

          const { data: completions } = await supabase
            .from('task_completions')
            .select('*')
            .eq('user_id', user.id)

          const { data: vitals } = await supabase
            .from('vitals_log')
            .select('*')
            .eq('user_id', user.id)

          exportPayload = {
            app: 'Naija Fitness Coach (Lite)',
            exported_at: new Date().toISOString(),
            compliance_framework: 'NDPR (Nigeria Data Protection Regulation)',
            account: {
              id: user.id,
              email: user.email,
              phone: user.phone,
              created_at: user.created_at
            },
            profile: userProfile || {},
            completions: completions || [],
            vitals_history: vitals || []
          }
        }
      }

      // Generate file download
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(exportPayload, null, 2)
      )}`
      const downloadAnchor = document.createElement('a')
      downloadAnchor.setAttribute('href', jsonString)
      downloadAnchor.setAttribute('download', `nfc-personal-data-${new Date().toISOString().split('T')[0]}.json`)
      document.body.appendChild(downloadAnchor)
      downloadAnchor.click()
      downloadAnchor.remove()
    } catch (err) {
      console.error('Failed to export data:', err)
    } finally {
      setIsExporting(false)
    }
  }

  // NDPR Data Deletion (Wipes completions and users tables + signs out)
  const handleDeleteData = async () => {
    if (confirmText !== 'DELETE') return
    setIsDeleting(true)

    try {
      if (isPreview) {
        localStorage.clear()
        alert('All local preview data and cookies cleared successfully.')
      } else {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          // Purge vitals explicitly
          await supabase
            .from('vitals_log')
            .delete()
            .eq('user_id', user.id)

          // Cascade policies will purge task completions when profile is deleted
          await supabase
            .from('task_completions')
            .delete()
            .eq('user_id', user.id)

          await supabase
            .from('users')
            .delete()
            .eq('id', user.id)

          await supabase.auth.signOut()
        }
      }
      window.location.href = '/sign-in'
    } catch (err) {
      console.error('Deletion failed:', err)
      setIsDeleting(false)
    }
  }

  // Submit self-report
  const handleSubmitSelfReport = async (e: React.FormEvent) => {
    e.preventDefault()
    setReportError(null)
    setReportSuccess(false)

    if (!reportReason) {
      setReportError('Please select a reason.')
      return
    }

    setReportLoading(true)
    if (isPreview) {
      const mockPause = {
        id: `pause_${Date.now()}`,
        patient_id: 'preview_user_id',
        reason: reportReason,
        note: reportNote.trim() || null,
        pause_starts_at: new Date().toISOString(),
        pause_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString()
      }
      localStorage.setItem('preview_active_pause', JSON.stringify(mockPause))
      setActivePause(mockPause)
      setReportSuccess(true)
      setReportLoading(false)
      // Close modal after short delay
      setTimeout(() => {
        setShowReportModal(false)
        setReportSuccess(false)
        setReportReason('')
        setReportNote('')
      }, 1000)
      return
    }

    const res = await submitSelfReportAction(reportReason, reportNote)
    if (res.success) {
      setReportSuccess(true)
      setReportReason('')
      setReportNote('')
      // Reload pause
      const pauseRes = await getActivePauseAction()
      if (pauseRes.success && pauseRes.activePause) {
        setActivePause(pauseRes.activePause)
      }
      setTimeout(() => {
        setShowReportModal(false)
        setReportSuccess(false)
      }, 1000)
    } else {
      setReportError(res.error || 'Failed to submit report.')
    }
    setReportLoading(false)
  }

  // Open Edit Profile Modal
  const openEditModal = () => {
    setEditName(profile.name)
    setEditPhone(profile.phone)
    setEditEmail(profile.email)
    setEditError(null)
    setEditSuccess(false)
    setShowEditModal(true)
  }

  // Handle Save Profile Details
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setEditError(null)
    setEditSuccess(false)

    if (!editName.trim()) {
      setEditError('Name is required.')
      return
    }

    setEditLoading(true)
    if (isPreview) {
      setProfile(prev => ({
        ...prev,
        name: editName,
        phone: editPhone,
        email: editEmail
      }))
      setEditSuccess(true)
      setEditLoading(false)
      setTimeout(() => {
        setShowEditModal(false)
        setEditSuccess(false)
      }, 1000)
      return
    }

    const res = await updateProfileDetailsAction(editName, editPhone, editEmail)
    if (res.success) {
      setEditSuccess(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: userProfile } = await supabase
          .from('users')
          .select('name, phone, condition, tier, show_tier_badge')
          .eq('id', user.id)
          .single()

        if (userProfile) {
          setProfile({
            name: userProfile.name || 'NFC Member',
            phone: userProfile.phone || user.phone || 'No phone recorded',
            email: user.email || '',
            condition: userProfile.condition || 'Hypertension',
            tier: userProfile.tier || 'Bronze'
          })
        }
      }
      setTimeout(() => {
        setShowEditModal(false)
        setEditSuccess(false)
      }, 1000)
    } else {
      setEditError(res.error || 'Failed to update profile.')
    }
    setEditLoading(false)
  }

  return (
    <div className="space-y-8 pb-8">
      {/* Header section */}
      <header className="space-y-1 py-4">
        <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">Preferences</p>
        <h1 className="text-3xl font-bold tracking-tight text-text-primary">Settings</h1>
        <p className="text-sm text-text-secondary">Manage your profile, authentication, and data privacy.</p>
      </header>

      {/* User Profile Card */}
      <section className="rounded-2xl bg-surface p-5 border border-divider/50 shadow-sm space-y-4">
        <div className="flex items-center space-x-3">
          <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center text-on-primary font-bold text-lg select-none">
            {profile.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="font-bold text-text-primary">{profile.name}</h3>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-xs text-text-secondary">{profile.phone}</span>
              <span className="text-xs bg-divider/50 text-text-secondary border border-divider/40 font-semibold px-2 py-0.5 rounded uppercase tracking-wider select-none font-mono">
                {profile.tier} Tier
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Preferences & Privacy Controls */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold text-text-secondary uppercase tracking-wider">
          Account & Privacy (NDPR)
        </h2>
        <div className="space-y-2">
          
          {/* Rough Patch / Pause check-ins (Section 2 & 3) */}
          {activePause ? (
            <div className="flex items-center justify-between rounded-2xl bg-amber-50/60 border border-amber-200/80 p-4">
              <div className="flex items-center space-x-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                <div className="space-y-0.5">
                  <span className="text-sm font-semibold text-text-primary block">Struggle Detection Paused</span>
                  <span className="text-xs text-text-secondary block">
                    Paused until {new Date(activePause.pause_ends_at).toLocaleDateString()} ({
                      activePause.reason === 'health_flareup' ? 'Health flare-up' :
                      activePause.reason === 'overwhelmed' ? 'Feeling overwhelmed' :
                      activePause.reason === 'busy_life' ? 'Busy with life' : 'Short break'
                    })
                  </span>
                </div>
              </div>
              <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Active</span>
            </div>
          ) : (
            <div 
              onClick={() => setShowReportModal(true)}
              className="flex items-center justify-between rounded-2xl bg-surface p-4 border border-divider/50 hover:border-primary/20 transition-colors cursor-pointer"
            >
              <div className="flex items-center space-x-3">
                <AlertTriangle className="h-5 w-5 text-text-secondary" />
                <span className="text-sm font-semibold text-text-primary">Having a rough patch?</span>
              </div>
              <span className="text-xs font-semibold text-primary uppercase tracking-wider font-mono">Report</span>
            </div>
          )}

          {/* Edit Personal Details (UI Link placeholder) */}
          <div 
            onClick={openEditModal}
            className="flex items-center justify-between rounded-2xl bg-surface p-4 border border-divider/50 hover:border-primary/20 transition-colors cursor-pointer"
          >
            <div className="flex items-center space-x-3">
              <User className="h-5 w-5 text-text-secondary" />
              <span className="text-sm font-semibold text-text-primary">Personal Details</span>
            </div>
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">Edit</span>
          </div>

          {/* Consistency Badge opt-in (Section 8.6) */}
          <div className="flex items-center justify-between rounded-2xl bg-surface p-4 border border-divider/50 hover:border-primary/20 transition-colors">
            <div className="flex items-center space-x-3">
              <Award className="h-5 w-5 text-text-secondary shrink-0" />
              <div className="space-y-1">
                <span className="text-sm font-semibold text-text-primary block leading-none">Display Consistency Badge</span>
                <span className="text-xs text-text-secondary block mt-0.5 leading-relaxed">Show your league tier next to your name in community posts</span>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer select-none shrink-0 ml-2">
              <input 
                type="checkbox" 
                checked={showTierBadge}
                onChange={(e) => handleToggleBadge(e.target.checked)}
                className="sr-only peer" 
              />
              <div className="w-9 h-5 bg-[#E6DCD0] rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-background after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>

          {/* NDPR Data Export */}
          <div 
            onClick={isExporting ? undefined : handleExportData}
            className="flex items-center justify-between rounded-2xl bg-surface p-4 border border-divider/50 hover:border-primary/20 transition-colors cursor-pointer"
          >
            <div className="flex items-center space-x-3">
              {isExporting ? (
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              ) : (
                <Download className="h-5 w-5 text-text-secondary" />
              )}
              <span className="text-sm font-semibold text-text-primary">Download My Personal Data</span>
            </div>
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">Export</span>
          </div>

          {/* NDPR Data Deletion */}
          <div 
            onClick={() => setShowDeleteModal(true)}
            className="flex items-center justify-between rounded-2xl bg-surface p-4 border border-divider/50 hover:border-[#D97706]/20 transition-colors cursor-pointer hover:bg-[#FAF0F0]/10"
          >
            <div className="flex items-center space-x-3">
              <Trash2 className="h-5 w-5 text-text-secondary" />
              <span className="text-sm font-semibold text-text-primary">Delete Data & Account</span>
            </div>
            <span className="text-xs font-semibold text-[#B83D3D] uppercase tracking-wider">Delete</span>
          </div>



        </div>
      </section>

      {/* Sign Out Button */}
      <div className="pt-6 flex justify-center">
        <Button variant="danger" onClick={handleSignOut} className="w-full flex items-center justify-center gap-2">
          <LogOut className="h-4 w-4" />
          <span>Sign Out</span>
        </Button>
      </div>

      {/* NDPR Data Deletion Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-text-primary/20 backdrop-blur-sm z-[999] flex items-end justify-center p-4">
          <div className="bg-surface w-full max-w-md rounded-2xl shadow-xl border border-divider/50 p-6 space-y-5 animate-in slide-in-from-bottom duration-300">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-bold text-[#B83D3D] uppercase tracking-wider block mb-1">Permanent Action</span>
                <h3 className="text-lg font-bold text-text-primary">Delete Account & Data?</h3>
              </div>
              <button 
                onClick={() => {
                  setShowDeleteModal(false)
                  setConfirmText('')
                }}
                className="p-1 rounded-full hover:bg-divider/50 transition-colors"
                disabled={isDeleting}
              >
                <X className="h-5 w-5 text-text-primary" />
              </button>
            </div>

            {/* Modal Warnings */}
            <div className="space-y-3 py-1">
              <p className="text-xs text-text-secondary leading-relaxed">
                This action is permanent and compliant with the Nigeria Data Protection Regulation (NDPR). 
                All your profile details, condition pathways, and check-in history will be instantly purged from our databases.
              </p>
              <div className="rounded-xl bg-[#FAF0F0]/50 border border-[#FAF0F0] p-4 text-[11px] text-[#B83D3D] leading-relaxed">
                <strong>Disclaimer:</strong> Your local logs and active database keys will be cleared. 
                Login credentials managed via authentication providers will be flagged for immediate administrative teardown.
              </div>
            </div>

            {/* Confirmation typing field */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-text-secondary uppercase tracking-wider block mb-0.5">
                Type &quot;DELETE&quot; to confirm
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE"
                className="w-full rounded-xl border border-divider/50 bg-transparent px-3 py-3 text-sm font-semibold tracking-wider text-text-primary placeholder:text-text-secondary/20 focus:outline-none focus:border-[#B83D3D] uppercase"
                disabled={isDeleting}
              />
            </div>

            {/* Action buttons */}
            <div className="space-y-2 pt-2">
              <Button
                variant="danger"
                disabled={confirmText !== 'DELETE' || isDeleting}
                onClick={handleDeleteData}
                className="w-full flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-background" />
                    <span>Deleting records...</span>
                  </>
                ) : (
                  <span>Permanently Purge My Records</span>
                )}
              </Button>
              <Button
                variant="secondary"
                disabled={isDeleting}
                onClick={() => {
                  setShowDeleteModal(false)
                  setConfirmText('')
                }}
                className="w-full"
              >
                Keep My Data
              </Button>
            </div>

          </div>
        </div>
      )}
      {/* Self Report (Rough Patch) Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-text-primary/20 backdrop-blur-sm z-[999] flex items-end sm:items-center justify-center p-4">
          <div className="bg-surface w-full max-w-md rounded-2xl shadow-xl border border-divider/50 p-6 space-y-4 animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between pb-2 border-b border-divider">
              <div>
                <span className="text-xs font-bold text-primary uppercase tracking-wider block mb-0.5">Rough Patch Report</span>
                <h3 className="text-lg font-bold text-text-primary">Having a rough patch?</h3>
              </div>
              <button 
                onClick={() => {
                  setShowReportModal(false)
                  setReportError(null)
                  setReportReason('')
                  setReportNote('')
                }} 
                className="text-text-secondary hover:text-text-primary"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitSelfReport} className="space-y-4">
              {reportError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs font-semibold">
                  {reportError}
                </div>
              )}
              {reportSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold">
                  Report submitted. Struggle detection paused for 7 days.
                </div>
              )}

              <div className="space-y-2">
                <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider">Select a reason</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { val: 'health_flareup', label: 'Health flare-up' },
                    { val: 'overwhelmed', label: 'Feeling overwhelmed' },
                    { val: 'busy_life', label: 'Busy with life/family' },
                    { val: 'need_break', label: 'Just need a short break' }
                  ].map(item => (
                    <button
                      key={item.val}
                      type="button"
                      onClick={() => setReportReason(item.val)}
                      className={`p-3 rounded-xl border text-xs font-semibold text-center transition-all ${
                        reportReason === item.val
                          ? 'border-[#781818] bg-[#781818]/5 text-[#781818]'
                          : 'border-divider/50 hover:bg-surface-secondary text-text-secondary'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider">Additional Notes (Optional)</label>
                <textarea
                  value={reportNote}
                  onChange={e => setReportNote(e.target.value)}
                  placeholder="Share any additional context with your coach if you like..."
                  rows={3}
                  className="w-full rounded-xl border border-divider/50 p-3 text-xs bg-surface-secondary focus:outline-none text-text-primary"
                />
              </div>

              <Button
                type="submit"
                disabled={reportLoading || !reportReason}
                className="w-full flex items-center justify-center gap-1.5 py-2.5"
              >
                {reportLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Pause Struggle Detection'}
              </Button>
            </form>
          </div>
        </div>
      )}
      {/* Edit Profile Details Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-text-primary/20 backdrop-blur-sm z-[999] flex items-end sm:items-center justify-center p-4">
          <div className="bg-surface w-full max-w-md rounded-2xl shadow-xl border border-divider/50 p-6 space-y-4 animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between pb-2 border-b border-divider">
              <div>
                <span className="text-xs font-bold text-primary uppercase tracking-wider block mb-0.5">Profile Settings</span>
                <h3 className="text-lg font-bold text-text-primary">Edit Personal Details</h3>
              </div>
              <button 
                onClick={() => setShowEditModal(false)} 
                className="text-text-secondary hover:text-text-primary"
                disabled={editLoading}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              {editError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs font-semibold">
                  {editError}
                </div>
              )}
              {editSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold">
                  Profile updated successfully!
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider">Full Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full rounded-xl border border-divider/50 p-3 text-xs bg-surface-secondary focus:outline-none text-text-primary"
                  placeholder="e.g. Bunmi K."
                  disabled={editLoading}
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider">Phone Number</label>
                <input
                  type="text"
                  required
                  value={editPhone}
                  onChange={e => setEditPhone(e.target.value)}
                  className="w-full rounded-xl border border-divider/50 p-3 text-xs bg-surface-secondary focus:outline-none text-text-primary"
                  placeholder="e.g. +2348030000000"
                  disabled={editLoading}
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider">Email Address</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={e => setEditEmail(e.target.value)}
                  className="w-full rounded-xl border border-divider/50 p-3 text-xs bg-surface-secondary focus:outline-none text-text-primary"
                  placeholder="e.g. patient@whealthafrica.com"
                  disabled={editLoading}
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-text-secondary/50 uppercase tracking-wider">Clinical Condition Focus</label>
                <input
                  type="text"
                  readOnly
                  value={profile.condition}
                  className="w-full rounded-xl border border-divider/30 p-3 text-xs bg-divider/10 text-text-secondary cursor-not-allowed"
                />
                <span className="text-[10px] text-text-secondary/60 block mt-1">
                  To change your condition, contact your coach or support.
                </span>
              </div>

              <Button
                type="submit"
                disabled={editLoading || !editName.trim() || !editPhone.trim()}
                className="w-full flex items-center justify-center gap-1.5 py-2.5"
              >
                {editLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Profile Changes'}
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
