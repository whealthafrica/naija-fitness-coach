'use server'

import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function submitSelfReportAction(reason: string, note: string) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Unauthorized.' }
  }

  // Check if active pause already exists
  const { data: existingPause } = await supabase
    .from('self_reports')
    .select('id')
    .eq('patient_id', user.id)
    .gt('pause_ends_at', new Date().toISOString())
    .limit(1)
    .maybeSingle()

  if (existingPause) {
    return { success: false, error: 'An active pause already exists for your account.' }
  }

  const { error } = await supabase
    .from('self_reports')
    .insert({
      patient_id: user.id,
      reason,
      note: note.trim() || null
    })

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/settings')
  return { success: true }
}

export async function getActivePauseAction() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Unauthorized.' }
  }

  const { data: activePause, error } = await supabase
    .from('self_reports')
    .select('*')
    .eq('patient_id', user.id)
    .gt('pause_ends_at', new Date().toISOString())
    .order('pause_ends_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    return {
      success: false,
      error: error.message
    }
  }

  return { success: true, activePause }
}

export async function updateProfileDetailsAction(name: string, phone: string, email: string) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Unauthorized.' }
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, error: 'Invalid email address format.' }
  }

  let formattedPhone = phone.trim()
  if (!formattedPhone.startsWith('+234')) {
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '+234' + formattedPhone.slice(1)
    } else {
      formattedPhone = '+234' + formattedPhone
    }
  }
  if (!/^\+234\d{10}$/.test(formattedPhone)) {
    return { success: false, error: 'Phone number must be in the format +234 followed by 10 digits (e.g. +2348030000000).' }
  }

  if (email !== user.email || formattedPhone !== user.phone) {
    const updatePayload: any = {}
    if (email !== user.email) updatePayload.email = email
    if (formattedPhone !== user.phone) updatePayload.phone = formattedPhone

    const { error: authUpdateErr } = await supabase.auth.updateUser(updatePayload)
    if (authUpdateErr) {
      return { success: false, error: 'Auth update failed: ' + authUpdateErr.message }
    }
  }

  const { error: dbUpdateErr } = await supabase
    .from('users')
    .update({
      name: name.trim(),
      phone: formattedPhone
    })
    .eq('id', user.id)

  if (dbUpdateErr) {
    return { success: false, error: 'Profile DB update failed: ' + dbUpdateErr.message }
  }

  revalidatePath('/settings')
  return { success: true }
}
