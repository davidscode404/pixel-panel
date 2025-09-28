'use client'

import Link from 'next/link';
import BookSlider from '../components/BookSlider';
import { useAuth } from '@/components/auth/AuthProvider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function Home() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();

  // Redirect authenticated users to protected area
  useEffect(() => {
    if (!loading && user) {
      router.push('/protected');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-900 to-stone-800">
        <div className="text-amber-50">Loading...</div>
      </div>
    );
  }

  // If user is authenticated, don't show the home page (will redirect)
  if (user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-900 to-stone-800">
        <div className="text-amber-50">Redirecting...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 sm:p-12 animated-gradient">
      {/* Auth buttons in top right */}
      <div className="absolute top-4 right-4 flex gap-2">
        <Link href="/auth/login">
          <button className="px-4 py-2 text-sm bg-stone-700/50 text-stone-200 rounded-md hover:bg-stone-600/50 transition-colors">
            Sign In
          </button>
        </Link>
        <Link href="/auth/signup">
          <button className="px-4 py-2 text-sm bg-amber-600 text-white rounded-md hover:bg-amber-700 transition-colors">
            Sign Up
          </button>
        </Link>
      </div>

      <main className="flex flex-col items-center gap-12">
        <div className="text-center max-w-2xl">
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight mb-6 text-amber-50 drop-shadow-2xl flex items-center justify-center gap-4">
            <img 
              src="/logo.png" 
              alt="PixelPanel Logo" 
              className="w-12 h-12 sm:w-16 sm:h-16 object-contain"
            />
            PixelPanel 
          </h1>
          <p className="text-base sm:text-lg text-stone-200 drop-shadow-lg">
            Generate your comic story via voice with our AI-powered comic generator agent. 
            Simply speak your ideas and watch them come to life!
          </p>
        </div>
        
        {/* Create Comic button */}
        <div className="flex justify-center">
          <Link href="/auth/login">
            <button className="group rounded-lg border border-solid border-amber-100/30 transition-all duration-300 flex items-center justify-center gap-2 bg-stone-800/40 backdrop-blur-sm text-amber-50 hover:bg-stone-700/50 hover:border-amber-100/50 font-medium text-base h-12 px-8 shadow-xl hover:shadow-2xl hover:scale-105">
              Create Your Comic
              <svg 
                className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
          </Link>
        </div>
        
        <BookSlider />
      </main>
    </div>
  );
}
