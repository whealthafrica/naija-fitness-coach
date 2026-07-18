'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  getCoachDashboardData,
  markNotificationAsRead,
  updateCoachPasswordAction,
  registerCoachAction,
  deactivateOrDeleteCoachAction,
  createPathwayAction,
  addLessonToDb,
  createCoachEventAction,
  cancelCoachEventAction,
  createAnnouncementAction
} from '../actions'
import { createClient } from '@/utils/supabase/client'
import {
  Loader2,
  Search,
  SlidersHorizontal,
  Bell,
  Check,
  Plus,
  Key,
  Shield,
  Settings,
  X,
  UserCheck,
  AlertTriangle,
  Video,
  Trash2,
  RefreshCw,
  LogOut,
  Calendar
} from 'lucide-react'

type DashboardTab = 'clients' | 'coaches' | 'pathways' | 'events' | 'announcements'

export default function CoachDashboard() {
  const router = useRouter()
  const supabase = createClient()

  // State
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<'coach' | 'superadmin'>('coach')
  const [clients, setClients] = useState<any[]>([])
  const [notifications, setNotifications] = useState<any[]>([])
  const [events, setEvents] = useState<any[]>([])
  const [stats, setStats] = useState<any>({ total: 0, avgProgress: 0, avgCP: 0, pendingFlagsCount: 0 })
  const [activeTab, setActiveTab] = useState<DashboardTab>('clients')

  // Events Form State
  const [eventModalOpen, setEventModalOpen] = useState(false)
  const [eventTitle, setEventTitle] = useState('')
  const [eventDescription, setEventDescription] = useState('')
  const [eventDatetime, setEventDatetime] = useState('')
  const [eventLoading, setEventLoading] = useState(false)
  const [eventError, setEventError] = useState<string | null>(null)
  const [selectedEventCoachId, setSelectedEventCoachId] = useState('')

  // Superadmin properties
  const [coachesList, setCoachesList] = useState<any[]>([])

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'tier' | 'flag'>('name')

  // Password Update Modal
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  // Coach Registration State
  const [regForm, setRegForm] = useState({
    email: '',
    password: '',
    name: '',
    condition: 'Type 2 Diabetes',
    intro: '',
    rankUpQuote: ''
  })
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [regLoading, setRegLoading] = useState(false)
  const [regError, setRegError] = useState<string | null>(null)
  const [regSuccess, setRegSuccess] = useState(false)

  // Coach Deactivation/Orphan logic state
  const [selectedCoachToManage, setSelectedCoachToManage] = useState<any | null>(null)
  const [reassignToCoachId, setReassignToCoachId] = useState('')
  const [deactivateLoading, setDeactivateLoading] = useState(false)
  const [deactivateError, setDeactivateError] = useState<string | null>(null)

  // Create Pathway State
  const [pathwayForm, setPathwayForm] = useState({
    condition: 'Type 2 Diabetes',
    youtubeLink: '',
    section: 'Foundation',
    durationText: '10 mins',
    durationSeconds: 600,
    title: '',
    midCheckpointPct: 65,
    endCheckpointPct: 85
  })
  const [pathwayLoading, setPathwayLoading] = useState(false)
  const [pathwayError, setPathwayError] = useState<string | null>(null)
  const [draftResult, setDraftResult] = useState<any | null>(null)
  const [midQuestionText, setMidQuestionText] = useState('')
  const [midOptions, setMidOptions] = useState<string[]>(['', '', ''])
  const [midCorrectOption, setMidCorrectOption] = useState('')
  const [endQuestionText, setEndQuestionText] = useState('')
  const [savePathwayLoading, setSavePathwayLoading] = useState(false)
  const [savePathwaySuccess, setSavePathwaySuccess] = useState(false)

  // Announcements Form State
  const [annTitle, setAnnTitle] = useState('')
  const [annBody, setAnnBody] = useState('')
  const [annLoading, setAnnLoading] = useState(false)
  const [annSuccess, setAnnSuccess] = useState(false)
  const [annError, setAnnError] = useState<string | null>(null)

  // Load Data
  const loadData = async () => {
    setLoading(true)
    const res = await getCoachDashboardData()
    if (res.success) {
      setRole(res.role as any)
      setClients(res.clients || [])
      setNotifications(res.notifications || [])
      setEvents(res.events || [])
      setStats(res.stats || { total: 0, avgProgress: 0, avgCP: 0, pendingFlagsCount: 0 })
    } else {
      router.push('/coach/login')
    }
    setLoading(false)
  }

  // Load Superadmin dependencies
  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (role === 'superadmin') {
      supabase.from('coaches').select('*').order('name').then(({ data }) => {
        if (data) setCoachesList(data)
      })
    }
  }, [role])

  // Handle Logout
  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/coach/login')
    router.refresh()
  }

  // Notification clear
  const handleMarkNotification = async (id: string) => {
    const res = await markNotificationAsRead(id)
    if (res.success) {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, unread: false } : n))
    }
  }

  // Create Coach Event
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    setEventError(null)

    if (!eventTitle.trim()) {
      setEventError('Event title is required.')
      return
    }
    if (!eventDatetime) {
      setEventError('Event date and time is required.')
      return
    }

    setEventLoading(true)

    const res = await createCoachEventAction(
      eventTitle,
      eventDescription,
      new Date(eventDatetime).toISOString(),
      role === 'superadmin' ? selectedEventCoachId || undefined : undefined
    )

    if (res.success) {
      setEventModalOpen(false)
      setEventTitle('')
      setEventDescription('')
      setEventDatetime('')
      loadData()
    } else {
      setEventError(res.error || 'Failed to create event.')
    }
    setEventLoading(false)
  }

  // Cancel Coach Event
  const handleCancelEvent = async (eventId: string) => {
    const confirmCancel = confirm('Are you sure you want to cancel this event?')
    if (!confirmCancel) return

    // Proceed with cancellation

    const res = await cancelCoachEventAction(eventId)
    if (res.success) {
      loadData()
    } else {
      alert(res.error || 'Failed to cancel event.')
    }
  }

  // Update Password
  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError(null)
    setPasswordSuccess(false)

    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters long.')
      return
    }

    setPasswordLoading(true)
    const res = await updateCoachPasswordAction(newPassword)
    if (res.success) {
      setPasswordSuccess(true)
      setNewPassword('')
    } else {
      setPasswordError(res.error || 'Password update failed.')
    }
    setPasswordLoading(false)
  }

  // Strict Filename & Condition Match Validation
  const validatePhotoForCondition = (condition: string, filename: string): boolean => {
    const cleanName = filename.toLowerCase()
    if (condition === 'Type 2 Diabetes' || condition === 'Pre-Diabetes') {
      return cleanName.includes('diabetes') || cleanName.includes('tunde') || cleanName.includes('emeka')
    } else if (condition === 'Hypertension') {
      return cleanName.includes('hypertension') || cleanName.includes('adaeze')
    } else if (condition === 'PCOS') {
      return cleanName.includes('pcos') || cleanName.includes('ngozi')
    } else if (condition === 'General Fitness') {
      return cleanName.includes('fitness') || cleanName.includes('amara')
    }
    return false
  }

  // Register Coach Form Submit
  const handleRegisterCoach = async (e: React.FormEvent) => {
    e.preventDefault()
    setRegError(null)
    setRegSuccess(false)

    if (!regForm.email || !regForm.password || !regForm.name || !photoFile) {
      setRegError('Please fill out all required fields and upload portrait photo.')
      return
    }

    // Enforce condition validation matching filename
    if (!validatePhotoForCondition(regForm.condition, photoFile.name)) {
      setRegError(`Invalid portrait image filename "${photoFile.name}" for condition "${regForm.condition}". Filename must correspond to assigned coach metadata (e.g. adaeze for Hypertension, tunde for Diabetes).`)
      return
    }

    setRegLoading(true)

    // Convert file to Base64
    const reader = new FileReader()
    reader.readAsDataURL(photoFile)
    reader.onload = async () => {
      const base64 = reader.result as string
      const res = await registerCoachAction(
        regForm.email,
        regForm.password,
        regForm.name,
        regForm.condition,
        base64,
        photoFile.name,
        regForm.intro,
        regForm.rankUpQuote
      )

      if (res.success) {
        setRegSuccess(true)
        setRegForm({
          email: '',
          password: '',
          name: '',
          condition: 'Type 2 Diabetes',
          intro: '',
          rankUpQuote: ''
        })
        setPhotoFile(null)
        // Reset file input in DOM
        const fileInput = document.getElementById('coach-photo-input') as HTMLInputElement
        if (fileInput) fileInput.value = ''
        
        const { data } = await supabase.from('coaches').select('*').order('name')
        if (data) setCoachesList(data)
      } else {
        setRegError(res.error || 'Registration failed.')
      }
      setRegLoading(false)
    }
  }

  // Coach deactivation submit
  const handleDeactivateCoach = async () => {
    setDeactivateError(null)
    if (!selectedCoachToManage) return

    setDeactivateLoading(true)
    const res = await deactivateOrDeleteCoachAction(selectedCoachToManage.id, reassignToCoachId || undefined)
    if (res.success) {
      setSelectedCoachToManage(null)
      setReassignToCoachId('')
      
      const { data } = await supabase.from('coaches').select('*').order('name')
      if (data) setCoachesList(data)
      loadData()
    } else {
      setDeactivateError(res.error || 'Action failed.')
    }
    setDeactivateLoading(false)
  }

  // Create Pathway draft
  const handleDraftPathway = async (e: React.FormEvent) => {
    e.preventDefault()
    setPathwayError(null)
    setDraftResult(null)

    if (!pathwayForm.youtubeLink || !pathwayForm.title) {
      setPathwayError('Please specify lesson title and YouTube watch link.')
      return
    }

    setPathwayLoading(true)
    const res = await createPathwayAction(pathwayForm.condition, pathwayForm.youtubeLink, pathwayForm.midCheckpointPct)
    if (res.success && res.data) {
      setDraftResult(res)
      setMidQuestionText(res.data.midPointQuestion.questionText)
      setMidOptions(res.data.midPointQuestion.options)
      setMidCorrectOption(res.data.midPointQuestion.correctOption)
      setEndQuestionText(res.data.endQuestionText)
    } else {
      setPathwayError(res.error || 'Drafting failed. Verify YouTube link has English subtitles.')
    }
    setPathwayLoading(false)
  }

  // Save Pathway lesson to database
  const handleSavePathwayLesson = async () => {
    if (!draftResult || !midQuestionText || !endQuestionText) return

    setSavePathwayLoading(true)
    const res = await addLessonToDb(
      pathwayForm.condition,
      pathwayForm.title,
      draftResult.videoId,
      pathwayForm.section,
      pathwayForm.durationText,
      pathwayForm.durationSeconds,
      midQuestionText,
      midOptions.filter(Boolean),
      midCorrectOption,
      endQuestionText,
      Number(pathwayForm.midCheckpointPct),
      Number(pathwayForm.endCheckpointPct)
    )

    if (res.success) {
      setSavePathwaySuccess(true)
      setDraftResult(null)
      setPathwayForm({
        condition: 'Type 2 Diabetes',
        youtubeLink: '',
        section: 'Foundation',
        durationText: '10 mins',
        durationSeconds: 600,
        title: '',
        midCheckpointPct: 65,
        endCheckpointPct: 85
      })
    } else {
      setPathwayError(res.error || 'Failed to save lesson.')
    }
    setSavePathwayLoading(false)
  }

  // Handle Publish Announcement
  const handlePublishAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault()
    setAnnError(null)
    setAnnSuccess(false)

    if (!annTitle.trim()) {
      setAnnError('Announcement title is required.')
      return
    }

    setAnnLoading(true)

    const res = await createAnnouncementAction(annTitle, annBody)
    if (res.success) {
      setAnnSuccess(true)
      setAnnTitle('')
      setAnnBody('')
    } else {
      setAnnError(res.error || 'Failed to publish announcement.')
    }
    setAnnLoading(false)
  }

  // Client list processing
  const filteredClients = clients
    .filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name)
      if (sortBy === 'tier') return b.programProgress - a.programProgress // High progress first
      if (sortBy === 'flag') return (b.hasPendingFlag ? 1 : 0) - (a.hasPendingFlag ? 1 : 0)
      return 0
    })

  if (loading && clients.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#781818]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-[#100808] font-sans pb-16">
      {/* Top Navbar */}
      <header className="bg-white border-b border-[#100808]/8 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-8 w-8 rounded-lg bg-[#781818] flex items-center justify-center text-background font-bold text-base">
              N
            </div>
            <span className="font-bold text-sm tracking-wider uppercase hidden sm:inline">NFC Coach Panel</span>
          </div>

          <div className="flex items-center gap-3">
            {role === 'superadmin' && (
              <div className="flex items-center gap-2 bg-background border border-[#100808]/10 px-3 py-1.5 rounded-xl text-xs font-semibold">
                <Shield className="h-3.5 w-3.5 text-[#C8923C]" />
                <span>Superadmin Role</span>
              </div>
            )}

            <button
              onClick={() => setPasswordModalOpen(true)}
              className="p-2.5 rounded-xl border border-[#100808]/10 hover:bg-background transition-colors"
              title="Account Settings"
            >
              <Settings className="h-4 w-4 text-[#100808]/60" />
            </button>

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-[#781818] text-white hover:opacity-90 transition-all"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-8">
        {/* welcome header */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Welcome back</h1>
            <p className="text-sm text-[#100808]/60 mt-1">Manage, support, and review patient health parameters.</p>
          </div>
        </div>

        {/* stats metrics card row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-[#100808]/8 p-5 rounded-2xl">
            <span className="text-xs font-bold text-[#100808]/40 uppercase tracking-wider block">Total Clients</span>
            <span className="text-3xl font-bold tracking-tight mt-2 block">{stats.total}</span>
          </div>
          <div className="bg-white border border-[#100808]/8 p-5 rounded-2xl">
            <span className="text-xs font-bold text-[#100808]/40 uppercase tracking-wider block">Avg Progress</span>
            <span className="text-3xl font-bold tracking-tight mt-2 block text-[#781818]">
              {stats.avgProgress.toFixed(1)}%
            </span>
          </div>
          <div className="bg-white border border-[#100808]/8 p-5 rounded-2xl">
            <span className="text-xs font-bold text-[#100808]/40 uppercase tracking-wider block">Avg CP Accumulated</span>
            <span className="text-3xl font-bold tracking-tight mt-2 block">{Math.round(stats.avgCP)}</span>
          </div>
          <div className="bg-white border border-[#100808]/8 p-5 rounded-2xl">
            <span className="text-xs font-bold text-[#100808]/40 uppercase tracking-wider block">Struggle Alerts</span>
            <span className={`text-3xl font-bold tracking-tight mt-2 block ${stats.pendingFlagsCount > 0 ? 'text-red-600' : ''}`}>
              {stats.pendingFlagsCount}
            </span>
          </div>
        </div>

        {/* Notifications and Core views layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main content Area (Left 2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            {/* View switching Tabs */}
            <div className="flex border-b border-[#100808]/8">
              <button
                onClick={() => setActiveTab('clients')}
                className={`px-4 py-2 text-sm font-bold border-b-2 transition-all ${
                  activeTab === 'clients' ? 'border-[#781818] text-[#781818]' : 'border-transparent text-[#100808]/60 hover:text-[#100808]'
                }`}
              >
                Client Registry
              </button>
              {role === 'superadmin' && (
                <>
                  <button
                    onClick={() => setActiveTab('coaches')}
                    className={`px-4 py-2 text-sm font-bold border-b-2 transition-all ${
                      activeTab === 'coaches' ? 'border-[#781818] text-[#781818]' : 'border-transparent text-[#100808]/60 hover:text-[#100808]'
                    }`}
                  >
                    Manage Coaches
                  </button>
                  <button
                    onClick={() => setActiveTab('pathways')}
                    className={`px-4 py-2 text-sm font-bold border-b-2 transition-all ${
                      activeTab === 'pathways' ? 'border-[#781818] text-[#781818]' : 'border-transparent text-[#100808]/60 hover:text-[#100808]'
                    }`}
                  >
                    Create Pathway
                  </button>
                  <button
                    onClick={() => setActiveTab('announcements')}
                    className={`px-4 py-2 text-sm font-bold border-b-2 transition-all ${
                      activeTab === 'announcements' ? 'border-[#781818] text-[#781818]' : 'border-transparent text-[#100808]/60 hover:text-[#100808]'
                    }`}
                  >
                    Announcements
                  </button>
                </>
              )}
              <button
                onClick={() => setActiveTab('events')}
                className={`px-4 py-2 text-sm font-bold border-b-2 transition-all ${
                  activeTab === 'events' ? 'border-[#781818] text-[#781818]' : 'border-transparent text-[#100808]/60 hover:text-[#100808]'
                }`}
              >
                Events
              </button>
            </div>

            {/* TAB CONTENT: CLIENT REGISTRY */}
            {activeTab === 'clients' && (
              <div className="bg-white border border-[#100808]/8 rounded-2xl p-6 space-y-4">
                <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                  <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#100808]/40" />
                    <input
                      type="text"
                      placeholder="Search clients..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#100808]/15 text-sm focus:outline-none focus:border-[#781818]"
                    />
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <SlidersHorizontal className="h-4 w-4 text-[#100808]/40" />
                    <select
                      value={sortBy}
                      onChange={e => setSortBy(e.target.value as any)}
                      className="rounded-xl border border-[#100808]/15 px-3 py-2 text-xs font-semibold bg-white text-[#100808] focus:outline-none"
                    >
                      <option value="name">Sort by Name</option>
                      <option value="tier">Sort by Progress</option>
                      <option value="flag">Sort by Struggle Alerts</option>
                    </select>
                  </div>
                </div>

                {filteredClients.length === 0 ? (
                  <p className="text-sm text-[#100808]/40 italic py-8 text-center">No clients match your filter criteria.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-[#100808]/8 text-[#100808]/40 font-bold uppercase tracking-wider text-xs">
                          <th className="pb-3 pr-4">Patient Name</th>
                          <th className="pb-3 pr-4">Condition</th>
                          <th className="pb-3 pr-4">Progress</th>
                          <th className="pb-3 pr-4">League Tier</th>
                          <th className="pb-3">Alerts</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#100808]/5">
                        {filteredClients.map(c => (
                          <tr
                            key={c.id}
                            onClick={() => router.push(`/coach/client?id=${c.id}`)}
                            className="hover:bg-background/30 cursor-pointer transition-colors"
                          >
                            <td className="py-4 pr-4 font-bold text-[#100808]">{c.name}</td>
                            <td className="py-4 pr-4 text-[#100808]/70">{c.condition}</td>
                            <td className="py-4 pr-4 font-semibold text-[#781818]">{c.programProgress.toFixed(1)}%</td>
                            <td className="py-4 pr-4 font-semibold">{c.tier}</td>
                            <td className="py-4">
                              {c.hasPendingFlag ? (
                                <span className="bg-red-50 border border-red-200 text-red-700 px-2.5 py-1 rounded-full text-xs font-semibold">
                                  Struggling
                                </span>
                              ) : (
                                <span className="text-[#100808]/30">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: MANAGE COACHES */}
            {activeTab === 'coaches' && role === 'superadmin' && (
              <div className="space-y-6">
                {/* Register New Coach Card */}
                <div className="bg-white border border-[#100808]/8 rounded-2xl p-6">
                  <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                    <UserCheck className="h-5 w-5 text-[#781818]" />
                    Register New Coach
                  </h3>

                  <form onSubmit={handleRegisterCoach} className="space-y-4">
                    {regError && (
                      <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs font-semibold leading-relaxed">
                        {regError}
                      </div>
                    )}
                    {regSuccess && (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold">
                        Coach registered successfully. Link sent to credentials database.
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-[#100808]/50 uppercase tracking-wider">Coach Name</label>
                        <input
                          type="text"
                          required
                          value={regForm.name}
                          onChange={e => setRegForm(p => ({ ...p, name: e.target.value }))}
                          placeholder="e.g. Adaeze"
                          className="mt-1 w-full rounded-xl border border-[#100808]/15 px-3 py-2 text-sm text-[#100808] bg-white focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-[#100808]/50 uppercase tracking-wider">Work Email</label>
                        <input
                          type="email"
                          required
                          value={regForm.email}
                          onChange={e => setRegForm(p => ({ ...p, email: e.target.value }))}
                          placeholder="coach@whealthafrica.com"
                          className="mt-1 w-full rounded-xl border border-[#100808]/15 px-3 py-2 text-sm text-[#100808] bg-white focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-[#100808]/50 uppercase tracking-wider">Initial Password</label>
                        <input
                          type="password"
                          required
                          value={regForm.password}
                          onChange={e => setRegForm(p => ({ ...p, password: e.target.value }))}
                          placeholder="At least 8 characters"
                          className="mt-1 w-full rounded-xl border border-[#100808]/15 px-3 py-2 text-sm text-[#100808] bg-white focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-[#100808]/50 uppercase tracking-wider">Assigned Condition</label>
                        <select
                          value={regForm.condition}
                          onChange={e => setRegForm(p => ({ ...p, condition: e.target.value }))}
                          className="mt-1 w-full rounded-xl border border-[#100808]/15 px-3 py-2 text-sm text-[#100808] bg-white focus:outline-none"
                        >
                          <option value="Type 2 Diabetes">Type 2 Diabetes</option>
                          <option value="Pre-Diabetes">Pre-Diabetes</option>
                          <option value="Hypertension">Hypertension</option>
                          <option value="PCOS">PCOS</option>
                          <option value="General Fitness">General Fitness</option>
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-[#100808]/50 uppercase tracking-wider">Upload Portrait (coach-*.png)</label>
                        <input
                          id="coach-photo-input"
                          type="file"
                          accept="image/*"
                          required
                          onChange={e => {
                            const file = e.target.files?.[0] || null
                            setRegError(null)
                            setRegSuccess(false)
                            if (file) {
                              if (!validatePhotoForCondition(regForm.condition, file.name)) {
                                setRegError(`Invalid portrait image filename "${file.name}" for condition "${regForm.condition}". Filename must correspond to assigned coach metadata (e.g. adaeze for Hypertension, tunde for Diabetes).`)
                                e.target.value = '' // Clear input in DOM
                                setPhotoFile(null)
                                return
                              }
                              setPhotoFile(file)
                            } else {
                              setPhotoFile(null)
                            }
                          }}
                          className="mt-1 w-full text-xs"
                        />
                        <span className="text-[10px] text-[#100808]/40 block mt-1">
                          Warning: Filename must strictly correspond to the assigned coach metadata (e.g. adaeze for Hypertension, tunde for Diabetes). This is strictly enforced.
                        </span>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-[#100808]/50 uppercase tracking-wider">Coach Intro Statement</label>
                        <textarea
                          value={regForm.intro}
                          onChange={e => setRegForm(p => ({ ...p, intro: e.target.value }))}
                          placeholder="Welcome statement shown to client on onboarding..."
                          rows={2}
                          className="mt-1 w-full rounded-xl border border-[#100808]/15 px-3 py-2 text-sm text-[#100808] bg-white focus:outline-none"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-[#100808]/50 uppercase tracking-wider">Rank-up Quote</label>
                        <textarea
                          value={regForm.rankUpQuote}
                          onChange={e => setRegForm(p => ({ ...p, rankUpQuote: e.target.value }))}
                          placeholder="Congratulatory quote shown on tier rank-up..."
                          rows={2}
                          className="mt-1 w-full rounded-xl border border-[#100808]/15 px-3 py-2 text-sm text-[#100808] bg-white focus:outline-none"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={regLoading}
                      className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#781818] text-white text-xs font-bold hover:opacity-90 disabled:opacity-50 transition-all"
                    >
                      {regLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      Register Coach
                    </button>
                  </form>
                </div>

                {/* Coaches Registry List */}
                <div className="bg-white border border-[#100808]/8 rounded-2xl p-6">
                  <h3 className="text-lg font-bold mb-4">Coaches Registry</h3>
                  {coachesList.length === 0 ? (
                    <p className="text-xs text-[#100808]/40 italic">No registered coaches found.</p>
                  ) : (
                    <div className="space-y-4">
                      {coachesList.map(c => (
                        <div key={c.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-[#100808]/8 rounded-xl gap-4">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-[#781818]/90 border border-[#781818]/15 overflow-hidden flex items-center justify-center shrink-0">
                              {c.illustration ? (
                                <img src={c.illustration} alt={c.name} className="h-full w-full object-cover" />
                              ) : (
                                <span className="text-background font-bold text-sm select-none">
                                  {c.name.charAt(0).toUpperCase()}
                                </span>
                              )}
                            </div>
                            <div>
                              <p className="font-bold">{c.name}</p>
                              <p className="text-xs text-[#100808]/60">{c.condition}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setSelectedCoachToManage(c)
                                setDeactivateError(null)
                              }}
                              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 text-red-700 text-xs font-bold hover:bg-red-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Deactivate
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT: CREATE PATHWAY */}
            {activeTab === 'pathways' && role === 'superadmin' && (
              <div className="bg-white border border-[#100808]/8 rounded-2xl p-6 space-y-6">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Video className="h-5 w-5 text-[#781818]" />
                  Add Pathway Lesson (Video Scraping & AI Generation)
                </h3>

                <form onSubmit={handleDraftPathway} className="space-y-4">
                  {pathwayError && (
                    <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs font-semibold">
                      {pathwayError}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-[#100808]/50 uppercase tracking-wider">Condition Focus</label>
                      <select
                        value={pathwayForm.condition}
                        onChange={e => setPathwayForm(p => ({ ...p, condition: e.target.value }))}
                        className="mt-1 w-full rounded-xl border border-[#100808]/15 px-3 py-2 text-sm text-[#100808] bg-white focus:outline-none"
                      >
                        <option value="Type 2 Diabetes">Type 2 Diabetes</option>
                        <option value="Pre-Diabetes">Pre-Diabetes</option>
                        <option value="Hypertension">Hypertension</option>
                        <option value="PCOS">PCOS</option>
                        <option value="General Fitness">General Fitness</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#100808]/50 uppercase tracking-wider">Lesson Title</label>
                      <input
                        type="text"
                        required
                        value={pathwayForm.title}
                        onChange={e => setPathwayForm(p => ({ ...p, title: e.target.value }))}
                        placeholder="e.g. Glucose Management"
                        className="mt-1 w-full rounded-xl border border-[#100808]/15 px-3 py-2 text-sm text-[#100808] bg-white focus:outline-none"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-[#100808]/50 uppercase tracking-wider">YouTube Video Link</label>
                      <input
                        type="url"
                        required
                        value={pathwayForm.youtubeLink}
                        onChange={e => setPathwayForm(p => ({ ...p, youtubeLink: e.target.value }))}
                        placeholder="https://www.youtube.com/watch?v=..."
                        className="mt-1 w-full rounded-xl border border-[#100808]/15 px-3 py-2 text-sm text-[#100808] bg-white focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#100808]/50 uppercase tracking-wider">Syllabus Section</label>
                      <input
                        type="text"
                        value={pathwayForm.section}
                        onChange={e => setPathwayForm(p => ({ ...p, section: e.target.value }))}
                        placeholder="e.g. Foundation, Advanced"
                        className="mt-1 w-full rounded-xl border border-[#100808]/15 px-3 py-2 text-sm text-[#100808] bg-white focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#100808]/50 uppercase tracking-wider">Duration Text / Seconds</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={pathwayForm.durationText}
                          onChange={e => setPathwayForm(p => ({ ...p, durationText: e.target.value }))}
                          placeholder="10 mins"
                          className="w-1/2 rounded-xl border border-[#100808]/15 px-3 py-2 text-sm text-[#100808] bg-white focus:outline-none"
                        />
                        <input
                          type="number"
                          value={pathwayForm.durationSeconds}
                          onChange={e => setPathwayForm(p => ({ ...p, durationSeconds: Number(e.target.value) }))}
                          placeholder="600"
                          className="w-1/2 rounded-xl border border-[#100808]/15 px-3 py-2 text-sm text-[#100808] bg-white focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#100808]/50 uppercase tracking-wider">Mid-Point Check Percentage</label>
                      <input
                        type="number"
                        value={pathwayForm.midCheckpointPct}
                        onChange={e => setPathwayForm(p => ({ ...p, midCheckpointPct: Number(e.target.value) }))}
                        className="mt-1 w-full rounded-xl border border-[#100808]/15 px-3 py-2 text-sm text-[#100808] bg-white focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#100808]/50 uppercase tracking-wider">End Check Percentage</label>
                      <input
                        type="number"
                        value={pathwayForm.endCheckpointPct}
                        onChange={e => setPathwayForm(p => ({ ...p, endCheckpointPct: Number(e.target.value) }))}
                        className="mt-1 w-full rounded-xl border border-[#100808]/15 px-3 py-2 text-sm text-[#100808] bg-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={pathwayLoading}
                    className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#781818] text-white text-xs font-bold hover:opacity-90 disabled:opacity-50 transition-all"
                  >
                    {pathwayLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Draft Pathway Checkpoints
                  </button>
                </form>

                {/* Draft Pathway Results & Confirmation */}
                {draftResult && (
                  <div className="p-5 border border-[#C8923C]/30 bg-background rounded-2xl space-y-4">
                    <h4 className="font-bold text-sm text-[#C8923C] uppercase tracking-wider">AI Drafted Checkpoints (Review Required)</h4>

                    {draftResult.data.isAmbiguous && (
                      <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl text-xs font-semibold">
                        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                        <div>
                          <strong>Ambiguity Warning:</strong> Video content appears ambiguous or unrelated to focus area.
                          <p className="mt-1 font-normal opacity-90">{draftResult.data.warningReason}</p>
                        </div>
                      </div>
                    )}

                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-[#100808]/50 uppercase tracking-wider">Mid-Point Scenario MCQ Question</label>
                        <textarea
                          value={midQuestionText}
                          onChange={e => setMidQuestionText(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-[#100808]/15 p-2 text-sm bg-white focus:outline-none"
                          rows={2}
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        {midOptions.map((opt, i) => (
                          <div key={i}>
                            <label className="block text-[10px] text-[#100808]/40 font-bold uppercase tracking-wider">Option {i + 1}</label>
                            <input
                              type="text"
                              value={opt}
                              onChange={e => setMidOptions(prev => {
                                const copy = [...prev]
                                copy[i] = e.target.value
                                return copy
                              })}
                              className="mt-1 w-full rounded-xl border border-[#100808]/15 p-2 text-xs bg-white focus:outline-none"
                            />
                          </div>
                        ))}
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#100808]/50 uppercase tracking-wider">Correct Option</label>
                        <select
                          value={midCorrectOption}
                          onChange={e => setMidCorrectOption(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-[#100808]/15 px-3 py-2 text-sm bg-white focus:outline-none"
                        >
                          <option value="">Select correct option...</option>
                          {midOptions.filter(Boolean).map(o => (
                            <option key={o} value={o}>{o}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#100808]/50 uppercase tracking-wider">End-Point Self-Reflection Question</label>
                        <textarea
                          value={endQuestionText}
                          onChange={e => setEndQuestionText(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-[#100808]/15 p-2 text-sm bg-white focus:outline-none"
                          rows={2}
                        />
                      </div>
                    </div>

                    <button
                      onClick={handleSavePathwayLesson}
                      disabled={savePathwayLoading || !midCorrectOption}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#781818] text-white text-xs font-bold hover:opacity-90 disabled:opacity-50 transition-all"
                    >
                      {savePathwayLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      Approve & Publish Lesson
                    </button>
                  </div>
                )}

                {savePathwaySuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold">
                    Lesson checkpoints published successfully and mapped to pathway Level 1.
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: EVENTS */}
            {activeTab === 'events' && (
              <div className="bg-white border border-[#100808]/8 rounded-2xl p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-[#781818]" />
                    Coach Scheduled Events
                  </h3>
                  <button
                    onClick={() => setEventModalOpen(true)}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl bg-[#781818] text-white text-xs font-bold hover:opacity-90 transition-all"
                  >
                    <Plus className="h-4 w-4" />
                    New Event
                  </button>
                </div>

                {/* Events list */}
                {events.length === 0 ? (
                  <p className="text-xs text-[#100808]/40 italic py-4">No events scheduled yet.</p>
                ) : (
                  <div className="space-y-3">
                    {events.map((evt: any) => {
                      const isPast = new Date(evt.event_datetime).getTime() < Date.now()
                      return (
                        <div
                          key={evt.id}
                          className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
                            evt.status === 'cancelled'
                              ? 'bg-red-50/30 border-red-200/50 opacity-60'
                              : isPast
                              ? 'bg-neutral-50/50 border-neutral-200/50 opacity-65'
                              : 'bg-white border-[#100808]/8 shadow-sm'
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-sm font-bold text-text-primary">{evt.title}</h4>
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider ${
                                evt.status === 'cancelled'
                                  ? 'bg-red-100 text-red-700'
                                  : isPast
                                  ? 'bg-neutral-200 text-neutral-600'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}>
                                {evt.status === 'cancelled' ? 'Cancelled' : isPast ? 'Past' : 'Upcoming'}
                              </span>
                              {role === 'superadmin' && coachesList.length > 0 && (
                                <span className="text-[9px] font-bold bg-[#C8923C]/10 text-[#C8923C] px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                                  Coach: {coachesList.find(c => c.id === evt.coach_id)?.name || 'Unknown'}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-text-secondary leading-relaxed">{evt.description || 'No description provided.'}</p>
                            <span className="text-[10px] text-text-secondary/70 font-mono block">
                              {new Date(evt.event_datetime).toLocaleString()}
                            </span>
                          </div>

                          {evt.status === 'upcoming' && !isPast && (
                            <button
                              onClick={() => handleCancelEvent(evt.id)}
                              className="self-start md:self-auto text-xs font-bold text-red-600 hover:text-red-700 hover:underline shrink-0"
                            >
                              Cancel Event
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Event Creation Modal */}
                {eventModalOpen && (
                  <div className="fixed inset-0 bg-text-primary/20 backdrop-blur-sm z-[999] flex items-center justify-center p-6">
                    <div className="bg-surface w-full max-w-md rounded-2xl shadow-xl border border-divider/50 p-6 space-y-4 animate-in zoom-in-95 duration-200">
                      <div className="flex items-center justify-between pb-2 border-b border-divider">
                        <h4 className="font-bold text-text-primary">Create Scheduled Event</h4>
                        <button onClick={() => setEventModalOpen(false)} className="text-text-secondary hover:text-text-primary">
                          <X className="h-5 w-5" />
                        </button>
                      </div>

                      <form onSubmit={handleCreateEvent} className="space-y-4 text-xs">
                        {eventError && (
                          <div className="p-2.5 bg-red-50 border border-red-200 text-red-800 rounded-xl font-semibold">
                            {eventError}
                          </div>
                        )}

                        {role === 'superadmin' && (
                          <div>
                            <label className="block font-bold text-[#100808]/50 uppercase tracking-wider">Assign to Coach</label>
                            <select
                              value={selectedEventCoachId}
                              onChange={e => setSelectedEventCoachId(e.target.value)}
                              className="mt-1 w-full rounded-xl border border-[#100808]/15 px-3 py-2 text-xs text-[#100808] bg-white focus:outline-none"
                            >
                              <option value="">Select coach...</option>
                              {coachesList.map(c => (
                                <option key={c.id} value={c.id}>{c.name} ({c.condition})</option>
                              ))}
                            </select>
                          </div>
                        )}

                        <div>
                          <label className="block font-bold text-[#100808]/50 uppercase tracking-wider">Event Title</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Group Vascular Health Discussion"
                            value={eventTitle}
                            onChange={e => setEventTitle(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-[#100808]/15 px-3 py-2 text-xs text-[#100808] focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-[#100808]/50 uppercase tracking-wider">Description</label>
                          <textarea
                            placeholder="Describe what will happen at this session..."
                            value={eventDescription}
                            onChange={e => setEventDescription(e.target.value)}
                            rows={3}
                            className="mt-1 w-full rounded-xl border border-[#100808]/15 px-3 py-2 text-xs text-[#100808] focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-[#100808]/50 uppercase tracking-wider">Date & Time</label>
                          <input
                            type="datetime-local"
                            required
                            value={eventDatetime}
                            onChange={e => setEventDatetime(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-[#100808]/15 px-3 py-2 text-xs text-[#100808] focus:outline-none"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={eventLoading}
                          className="w-full py-2.5 rounded-xl bg-[#781818] text-white text-xs font-bold hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
                        >
                          {eventLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Schedule Event'}
                        </button>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: ANNOUNCEMENTS */}
            {activeTab === 'announcements' && role === 'superadmin' && (
              <div className="bg-white border border-[#100808]/8 rounded-2xl p-6 space-y-6">
                <div className="flex items-center justify-between pb-3 border-b border-divider">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Bell className="h-5 w-5 text-[#781818]" />
                    Publish Site-wide Product Announcement
                  </h3>
                </div>

                <form onSubmit={handlePublishAnnouncement} className="space-y-4">
                  {annError && (
                    <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs font-semibold">
                      {annError}
                    </div>
                  )}
                  {annSuccess && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold">
                      Announcement published successfully!
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-[#100808]/50 uppercase tracking-wider">Announcement Title</label>
                    <input
                      type="text"
                      required
                      value={annTitle}
                      onChange={e => setAnnTitle(e.target.value)}
                      placeholder="e.g. New Pathway: Advanced Mobility Released"
                      className="mt-1 w-full rounded-xl border border-[#100808]/15 px-3 py-2 text-sm text-[#100808] bg-white focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-[#100808]/50 uppercase tracking-wider">Announcement Body</label>
                    <textarea
                      required
                      value={annBody}
                      onChange={e => setAnnBody(e.target.value)}
                      placeholder="Enter the main content details..."
                      rows={4}
                      className="mt-1 w-full rounded-xl border border-[#100808]/15 px-3 py-2 text-sm text-[#100808] bg-white focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={annLoading}
                    className="w-full py-2.5 rounded-xl bg-[#781818] text-white text-xs font-bold hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
                  >
                    {annLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Publish Site-wide Announcement'}
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Sidebar Notifications Feed (Right 1 col) */}
          <div className="bg-white border border-[#100808]/8 rounded-2xl p-6 h-fit space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#100808]/8">
              <h3 className="font-bold flex items-center gap-2">
                <Bell className="h-4 w-4 text-[#781818]" />
                System Alerts ({notifications.filter(n => n.unread).length})
              </h3>
            </div>

            {notifications.length === 0 ? (
              <p className="text-xs text-[#100808]/40 italic py-4">No recent notification alerts.</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {notifications.map(n => (
                  <div
                    key={n.id}
                    className={`p-3 rounded-xl border text-xs transition-all relative ${
                      n.unread ? 'bg-amber-50/60 border-amber-200/80 font-medium' : 'bg-white border-[#100808]/5 opacity-60'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-[#100808]">New Patient Onboarded</p>
                        <p className="text-[#100808]/70 mt-0.5">{n.patientName} ({n.patientCondition})</p>
                        <span className="text-[10px] text-[#100808]/40 mt-1 block">
                          {new Date(n.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      {n.unread && (
                        <button
                          onClick={() => handleMarkNotification(n.id)}
                          className="text-[#781818] hover:opacity-75"
                          title="Mark Read"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* MODAL: Account Password Settings */}
      {passwordModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white max-w-sm w-full rounded-2xl p-6 border border-[#100808]/8 space-y-4 relative shadow-2xl">
            <button
              onClick={() => {
                setPasswordModalOpen(false)
                setPasswordError(null)
                setPasswordSuccess(false)
              }}
              className="absolute right-4 top-4 text-[#100808]/40 hover:text-[#100808]"
            >
              <X className="h-4 w-4" />
            </button>

            <h3 className="font-bold text-lg flex items-center gap-2">
              <Key className="h-5 w-5 text-[#C8923C]" />
              Account Settings
            </h3>
            <p className="text-xs text-[#100808]/60">Standard credentials security. Update your dashboard account password.</p>

            <form onSubmit={handlePasswordUpdate} className="space-y-4 pt-2">
              {passwordError && (
                <div className="p-2.5 bg-red-50 border border-red-200 text-red-800 text-xs rounded-xl font-semibold font-sans">
                  {passwordError}
                </div>
              )}
              {passwordSuccess && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl font-semibold font-sans">
                  Password updated successfully.
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-[#100808]/50 uppercase tracking-wider">New Password</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="mt-1 w-full rounded-xl border border-[#100808]/15 px-3 py-2 text-sm text-[#100808] bg-white focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={passwordLoading}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-xs font-bold text-white bg-[#781818] hover:opacity-90 disabled:opacity-50 transition-all"
              >
                {passwordLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update Password'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Coach Deactivation & Client Reassignment */}
      {selectedCoachToManage && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white max-w-sm w-full rounded-2xl p-6 border border-[#100808]/8 space-y-4 relative shadow-2xl">
            <button
              onClick={() => setSelectedCoachToManage(null)}
              className="absolute right-4 top-4 text-[#100808]/40 hover:text-[#100808]"
            >
              <X className="h-4 w-4" />
            </button>

            <h3 className="font-bold text-lg text-red-800 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Deactivate {selectedCoachToManage.name}
            </h3>

            {deactivateError && (
              <div className="p-2.5 bg-red-50 border border-red-200 text-red-800 text-xs rounded-xl font-semibold leading-relaxed font-sans">
                {deactivateError}
              </div>
            )}

            <p className="text-xs text-[#100808]/60 leading-relaxed font-sans">
              Before deactivating/deleting a coach profile, we must safely reassign all their currently active clients to a different coach.
            </p>

            <div className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-[#100808]/50 uppercase tracking-wider">Reassign clients to:</label>
                <select
                  value={reassignToCoachId}
                  onChange={e => setReassignToCoachId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#100808]/15 px-3 py-2 text-sm bg-white text-[#100808] focus:outline-none"
                >
                  <option value="">Select destination coach...</option>
                  {coachesList.filter(c => c.id !== selectedCoachToManage.id).map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.condition})</option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleDeactivateCoach}
                disabled={deactivateLoading}
                className="w-full flex justify-center py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-red-700 hover:opacity-90 disabled:opacity-50 transition-all"
              >
                {deactivateLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm Deactivation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
