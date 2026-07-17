'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/utils/supabase/client'
import { Button } from '@/components/Button'
import { motion } from 'framer-motion'
import { Heart, Activity, Sparkles, Droplet, Dumbbell, Loader2 } from 'lucide-react'

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  'diabetes': Droplet,
  'hypertension': Heart,
  'pcos': Sparkles,
  'pre-diabetes': Activity,
  'general-fitness': Dumbbell
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
        // Ignored if blocked by browser security
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

    // Proceed with database update

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
    <div className="flex flex-col min-h-screen px-6 py-8 justify-start bg-background">
      {/* Header with Short Illustration and Text */}
      <div className="space-y-4 text-center mt-1">
        {/* Short Illustration (five small objects from above - fills 85% width, hugs height dynamically) */}
        <Image
          src="/condition-header.png"
          alt="Focus area illustration"
          width={400}
          height={80}
          priority
          className="w-[85%] h-auto mx-auto object-contain block"
        />
        
        <h2 className="text-xl font-semibold tracking-tight text-text-primary px-4">
          What are you working on right now?
        </h2>
      </div>

      {/* Form holds cards and continue button, pushing button to bottom */}
      <form 
        onSubmit={(e) => {
          e.preventDefault()
          handleSave()
        }} 
        className="flex-1 flex flex-col justify-between w-full max-w-sm mx-auto mt-6"
      >
        {/* MCQ Option Stack */}
        <div className="flex flex-col gap-3 w-full">
          {conditions.map((item) => {
            const isSelected = selectedCondition === item.id
            const isAnySelected = selectedCondition !== null
            
            // Determine opacity based on whether any card is active
            const cardOpacity = !isAnySelected ? 1 : isSelected ? 1 : 0.7

            return (
              <motion.button
                key={item.id}
                type="button"
                onClick={() => handleCardClick(item.id)}
                disabled={loading}
                
                // Scale-up-then-settle transition keyframes
                animate={isSelected ? { scale: [1, 1.01, 1] } : { scale: 1 }}
                transition={{ duration: 0.25 }}
                
                className="w-full flex items-center justify-between rounded-2xl border outline-none transition-all duration-200 py-4 px-5 text-left"
                style={{
                  backgroundColor: isSelected ? '#7818180F' : '#FAF4EC', // 6% Deep Maroon vs Warm Cream
                  borderColor: isSelected ? '#781818' : '#E6DCD0',
                  opacity: cardOpacity
                }}
              >
                <div className="flex items-center space-x-4">
                  {/* Radio Indicator */}
                  <div className={`h-5 w-5 rounded-full border flex items-center justify-center transition-all ${
                    isSelected ? 'border-[#781818]' : 'border-[#100808]/20'
                  }`}>
                    {isSelected && (
                      <div className="h-2.5 w-2.5 rounded-full bg-[#781818]" />
                    )}
                  </div>
                  <span className="font-bold text-sm text-[#100808] tracking-tight">
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

        {/* Deliberate Continue Tap Proceed Button */}
        <div className="mt-8 w-full">
          <Button
            variant="primary"
            onClick={handleSave}
            type="submit"
            disabled={!selectedCondition || loading}
          >
            <span className="w-full flex items-center justify-center gap-2">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-on-primary" />
                  <span>Saving settings...</span>
                </>
              ) : (
                <span>Continue</span>
              )}
            </span>
          </Button>
        </div>
      </form>
    </div>
  )
}
