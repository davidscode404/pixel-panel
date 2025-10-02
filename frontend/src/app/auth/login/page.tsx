'use client'

import { useState, Suspense } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

function LoginFormContent() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // Get the intended destination from URL params, default to /protected
  const redirectTo = searchParams.get('redirect') || '/protected'
  
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Successfully signed in!')
      router.push(redirectTo)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-900 to-stone-800">
      <div className="max-w-md w-full space-y-8 p-8 bg-stone-800/50 backdrop-blur-sm rounded-lg shadow-lg">
        <div className="text-center">
          <div className="flex justify-center items-center gap-2 mb-4">
            <Image
              src="/logo.png"
              alt="PixelPanel Logo"
              width={48}
              height={48}
              className="w-12 h-12 object-contain flex-shrink-0"
              priority
            />
            <h1 className="text-3xl font-bold text-orange-500 leading-none">PixelPanel</h1>
          </div>
          <h2 className="text-2xl font-bold text-amber-50 mb-2">Sign In</h2>
          <p className="text-stone-300">Welcome back to PixelPanel</p>
        </div>
        
        <form className="space-y-6" onSubmit={handleLogin}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-stone-200 mb-2">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-stone-600 rounded-md shadow-sm bg-stone-700/50 text-amber-50 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="Enter your email"
            />
          </div>
          
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-stone-200 mb-2">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-stone-600 rounded-md shadow-sm bg-stone-700/50 text-amber-50 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="Enter your password"
            />
          </div>

          {message && (
            <div className={`text-sm ${message.includes('Successfully') ? 'text-green-400' : 'text-red-400'}`}>
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div className="text-center">
          <p className="text-stone-300">
            Don&apos;t have an account?{' '}
            <Link href="/auth/signup" className="text-orange-500 hover:text-orange-400">
              Sign up
            </Link>
          </p>
          <Link href="/" className="text-stone-300 hover:text-amber-50 text-sm mt-4 inline-block">
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function LoginForm() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginFormContent />
    </Suspense>
  )
}