'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    
    try {
      // TODO: Implement password reset functionality
      setMessage('Password reset email sent! Check your inbox.')
    } catch {
      setMessage('Error sending reset email. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-900 to-stone-800">
      <div className="max-w-md w-full mx-4">
        <div className="bg-stone-800/50 backdrop-blur-sm rounded-lg shadow-xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-amber-50 mb-2">Reset Password</h1>
            <p className="text-stone-300">Enter your email to receive a reset link</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-stone-200 mb-2">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 bg-stone-700/50 border border-stone-600 rounded-lg text-amber-50 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                placeholder="Enter your email"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-amber-600 text-white py-3 rounded-lg font-medium hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Sending...' : 'Send Reset Link'}
            </button>

            {message && (
              <div className={`text-center text-sm ${message.includes('Error') ? 'text-red-400' : 'text-green-400'}`}>
                {message}
              </div>
            )}
          </form>

          <div className="mt-6 text-center">
            <Link href="/auth/login" className="text-amber-400 hover:text-amber-300 text-sm">
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
