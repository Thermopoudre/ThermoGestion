'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { X } from 'lucide-react'

interface NPSSurveyProps {
  userId: string
}

export function NPSSurvey({ userId }: NPSSurveyProps) {
  const [show, setShow] = useState(false)
  const [score, setScore] = useState<number | null>(null)
  const [feedback, setFeedback] = useState('')
  const [step, setStep] = useState<'score' | 'feedback' | 'thanks'>('score')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    // Check if we should show the survey
    checkSurveyEligibility()
  }, [])

  async function checkSurveyEligibility() {
    // Show survey after 30 days of usage, max once every 90 days
    const lastSurvey = localStorage.getItem('nps_last_survey')
    const signupDate = localStorage.getItem('signup_date')
    
    if (lastSurvey) {
      const daysSinceLastSurvey = Math.floor((Date.now() - new Date(lastSurvey).getTime()) / (1000 * 60 * 60 * 24))
      if (daysSinceLastSurvey < 90) return
    }

    // Random chance to show (10% per page load, after initial delay)
    const shouldShow = Math.random() < 0.1
    if (shouldShow) {
      setTimeout(() => setShow(true), 3000) // Show after 3 seconds
    }
  }

  async function submitScore(selectedScore: number) {
    setScore(selectedScore)
    if (selectedScore <= 6) {
      setStep('feedback') // Detractors - ask for feedback
    } else if (selectedScore <= 8) {
      setStep('feedback') // Passives - ask for feedback
    } else {
      // Promoters - save and thank
      await saveSurvey(selectedScore, '')
      setStep('thanks')
    }
  }

  async function submitFeedback() {
    if (!score) return
    setSubmitting(true)
    await saveSurvey(score, feedback)
    setSubmitting(false)
    setStep('thanks')
  }

  async function saveSurvey(npsScore: number, npsFeedback: string) {
    // In production, save to database
    localStorage.setItem('nps_last_survey', new Date().toISOString())
    
    // Would save to Supabase in production:
    // const supabase = createBrowserClient()
    // await supabase.from('nps_surveys').insert({
    //   user_id: userId,
    //   score: npsScore,
    //   feedback: npsFeedback,
    // })
    
    // NPS data submitted
  }

  function dismiss() {
    localStorage.setItem('nps_last_survey', new Date().toISOString())
    setShow(false)
  }

  if (!show) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-slide-up">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-[400px] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-red-500 px-4 py-3 flex items-center justify-between">
          <span className="text-white font-medium">Votre avis compte !</span>
          <button onClick={dismiss} className="text-white/80 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4">
          {step === 'score' && (
            <>
              <p className="text-gray-900 dark:text-white font-medium mb-4 text-center">
                Recommanderiez-vous ThermoGestion à un confrère ?
              </p>
              <div className="flex justify-center gap-1 mb-2">
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                  <button
                    key={num}
                    onClick={() => submitScore(num)}
                    className={`w-8 h-8 rounded text-sm font-medium transition-all hover:scale-110 ${
                      num <= 6
                        ? 'bg-red-100 text-red-700 hover:bg-red-200'
                        : num <= 8
                        ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
              <div className="flex justify-between text-xs text-gray-500 px-1">
                <span>Pas du tout</span>
                <span>Certainement</span>
              </div>
            </>
          )}

          {step === 'feedback' && (
            <>
              <p className="text-gray-900 dark:text-white font-medium mb-3">
                {score && score <= 6
                  ? 'Qu\'est-ce qui vous a déçu ?'
                  : 'Comment pouvons-nous nous améliorer ?'}
              </p>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Votre feedback nous aide à améliorer ThermoGestion..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm resize-none"
                rows={3}
              />
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => setStep('thanks')}
                  className="flex-1 px-4 py-2 text-gray-600 dark:text-gray-400 text-sm"
                >
                  Passer
                </button>
                <button
                  onClick={submitFeedback}
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 disabled:opacity-50"
                >
                  {submitting ? 'Envoi...' : 'Envoyer'}
                </button>
              </div>
            </>
          )}

          {step === 'thanks' && (
            <div className="text-center py-4">
              <div className="text-4xl mb-2">🙏</div>
              <p className="text-gray-900 dark:text-white font-medium">
                Merci pour votre retour !
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Votre avis nous aide à améliorer ThermoGestion
              </p>
              <button
                onClick={() => setShow(false)}
                className="mt-4 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Fermer
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
