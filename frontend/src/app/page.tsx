'use client'

import Link from 'next/link';
import Image from 'next/image';
import BookSlider from '../components/BookSlider';
import Footer from '@/components/ui/Footer';
import { useAuth } from '@/components/auth/AuthProvider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Redirect authenticated users to protected area
  useEffect(() => {
    if (!loading && user) {
      router.push('/protected');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-foreground">Loading...</div>
      </div>
    );
  }

  // If user is authenticated, don't show the home page (will redirect)
  if (user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-foreground">Redirecting...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-stone-900 to-stone-800">
      <div className="flex-1 p-8 sm:p-12">
        {/* Auth buttons in top right */}
        <div className="absolute top-4 right-4 flex gap-2">
          <Link href="/auth/login">
            <button className="px-4 py-2 text-sm bg-stone-700/50 text-stone-200 rounded-md hover:bg-stone-600/50 transition-colors border border-stone-600">
              Sign In
            </button>
          </Link>
          <Link href="/auth/signup">
            <button className="px-4 py-2 text-sm bg-orange-500 text-white rounded-md hover:bg-orange-600 transition-colors">
              Sign Up
            </button>
          </Link>
        </div>

        <main className="flex flex-col items-center gap-12">
          <div className="text-center max-w-2xl">
            <div className="flex justify-center items-center gap-2 mb-6">
              <Image
                src="/logo.png"
                alt="PixelPanel Logo"
                width={72}
                height={72}
                className="w-16 h-16 sm:w-20 sm:h-20 object-contain flex-shrink-0"
                priority
              />
              <h1 className="text-4xl sm:text-6xl font-bold text-orange-500 drop-shadow-2xl leading-none m-0">
                PixelPanel
              </h1>
            </div>
            <p className="text-base sm:text-lg text-stone-300 drop-shadow-lg">
              Generate your comic story via voice with our AI-powered comic generator agent.
              Simply speak your ideas and watch them come to life!
            </p>
          </div>

          {/* Create Comic button */}
          <div className="flex justify-center">
            <Link href="/auth/login">
              <button className="group rounded-lg border border-solid border-orange-500/30 transition-all duration-300 flex items-center justify-center gap-2 bg-stone-800/40 backdrop-blur-sm text-amber-50 hover:bg-stone-700/50 hover:border-orange-500/50 font-medium text-base h-12 px-8 shadow-xl hover:shadow-2xl hover:scale-105">
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
      <Footer />
    </div>
  );
}
