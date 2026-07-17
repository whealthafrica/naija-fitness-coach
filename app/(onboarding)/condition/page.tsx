'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/utils/supabase/client'
import { Button } from '@/components/Button'
import { motion } from 'framer-motion'
import { HeartPulse, Moon, Activity, Droplet, Dumbbell, Loader2 } from 'lucide-react'

// Define matching left icons for each condition (unambiguous, consistent stroke, Comfort size)
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  'diabetes': Droplet, // droplet/glucose icon
  'hypertension': HeartPulse, // heart-pulse icon
  'pcos': Moon, // moon/cycle icon
  'pre-diabetes': Activity, // pulse-line icon (distinct from HeartPulse)
  'general-fitness': Dumbbell // clear dumbbell icon (unambiguous)
}

export default function ConditionPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [selectedCondition, setSelectedCondition] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const conditions = [
    { id: 'diabetes', name: 'Type 2 Diabetes' },
    { id: 'hypertension', name: 'Hypertension' },
    { id: 'pcos', name: 'PCOS' },
    { id: 'pre-diabetes', name: 'Pre-Diabetes' },
    { id: 'general-fitness', name: 'General Fitness' }
  ]

  // Handles haptic feedback on mobile if supported
  const triggerHaptic = () => {
    if (typeof window !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(12)
      } catch (e) {
        // Ignored
      }
    }
  }

  const handleCardClick = (id: string) => {
    triggerHaptic()
    setError(null)
    
    setSelectedCondition((prev) => {
      if (prev === id) {
        return null // Deselect if tapped again
      }
      return id // Select new card
    })
  }

  const handleSave = async () => {
    if (!selectedCondition) return
    
    setError(null)
    setLoading(true)

    const conditionName = conditions.find(c => c.id === selectedCondition)?.name || selectedCondition

    const coachMap: Record<string, string> = {
      'Hypertension': 'adaeze',
      'Type 2 Diabetes': 'tunde',
      'PCOS': 'ngozi',
      'Pre-Diabetes': 'emeka',
      'General Fitness': 'amara'
    }
    const coachCode = coachMap[conditionName] || 'amara'

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()

      if (userError || !user) {
        setError('Authentication session not found. Please sign in again.')
        setLoading(false)
        return
      }

      // Update the public.users profile 'condition' field
      const { error: updateError } = await supabase
        .from('users')
        .update({ condition: conditionName })
        .eq('id', user.id)

      if (updateError) {
        // Fallback: try upserting if record is not found (triggered by database edge cases)
        const { error: upsertError } = await supabase
          .from('users')
          .upsert({
            id: user.id,
            phone: user.phone || '',
            condition: conditionName,
            name: user.user_metadata?.name || 'New Patient'
          })

        if (upsertError) {
          setError(`Database error: ${upsertError.message}`)
          setLoading(false)
          return
        }
      }

      window.location.href = `/coach?code=${coachCode}`
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen justify-start bg-[#F8F8F0] pb-36">
      {/* Header with Short Illustration and Text */}
      <div className="space-y-4 text-center mt-8 px-6">
        <Image
          src="/condition-header.png"
          alt="Focus area illustration"
          width={400}
          height={80}
          priority
          className="w-[85%] h-auto mx-auto object-contain block animate-fade-in"
        />
        
        <h2 className="text-2xl font-bold tracking-tight text-[#100808] px-4 font-sans">
          What are you focused on right now?
        </h2>
      </div>

      {/* Main Form container with layout spacing composition */}
      <form 
        onSubmit={(e) => {
          e.preventDefault()
          handleSave()
        }} 
        className="w-full max-w-sm mx-auto px-6 mt-10"
      >
        {/* Option Rows - spacious list layout */}
        <div className="flex flex-col gap-4 w-full">
          {conditions.map((item) => {
            const isSelected = selectedCondition === item.id
            const isAnySelected = selectedCondition !== null
            const IconComponent = iconMap[item.id]
            
            // Unselected rows dim to 55-60% when a selection is active
            const cardOpacity = !isAnySelected ? 1.0 : isSelected ? 1.0 : 0.58

            return (
              <motion.button
                key={item.id}
                type="button"
                onClick={() => handleCardClick(item.id)}
                disabled={loading}
                
                // Scale bump (1.02x) with smooth quick easing transition (150-200ms)
                animate={isSelected ? { scale: 1.02 } : { scale: 1.0 }}
                transition={{ duration: 0.18, ease: 'easeInOut' }}
                
                // Uses card border-radius (rounded-2xl) matching settings rows rather than primary button pills
                className="w-full flex items-center rounded-2xl border outline-none transition-all duration-200 py-5 px-6 text-left bg-white shadow-sm"
                style={{
                  backgroundColor: isSelected ? '#7818180F' : '#FFFFFF', // Burgundy wash background
                  borderColor: isSelected ? '#781818' : '#1008080A',
                  borderWidth: isSelected ? '1.5px' : '1px',
                  opacity: cardOpacity
                }}
              >
                <div className="flex items-center space-x-6 w-full">
                  {/* Left Comfort legibility Icon */}
                  {IconComponent && (
                    <IconComponent 
                      className={`h-7 w-7 stroke-[1.8] transition-colors duration-200 shrink-0 ${
                        isSelected ? 'text-[#781818]' : 'text-[#100808]/60'
                      }`}
                    />
                  )}
                  <span className={`font-bold text-base tracking-tight transition-colors duration-200 ${
                    isSelected ? 'text-[#781818]' : 'text-[#100808]'
                  }`}>
                    {item.name}
                  </span>
                </div>
              </motion.button>
            )
          })}

          {error && (
            <div className="rounded-xl bg-danger/10 border border-danger/20 p-4 text-xs text-danger font-medium text-center">
              {error}
            </div>
          )}
        </div>

        {/* Viewport Pinned Continue Tap Button */}
        <div className="fixed bottom-0 left-0 right-0 bg-[#F8F8F0]/80 backdrop-blur-md border-t border-[#100808]/5 px-6 py-5 z-40">
          <div className="max-w-sm mx-auto">
            <Button
              variant="primary"
              onClick={handleSave}
              type="submit"
              disabled={!selectedCondition || loading}
              className="w-full shadow-md"
            >
              <span className="w-full flex items-center justify-center gap-2">
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin text-white" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Continue</span>
                )}
              </span>
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
