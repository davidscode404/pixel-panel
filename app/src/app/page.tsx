import Link from 'next/link';
import BookSlider from '../components/BookSlider';

export default function Home() {
  return (
    <div className="min-h-screen p-8 sm:p-12 animated-gradient">
      <main className="flex flex-col items-center gap-12">
        <div className="text-center max-w-2xl">
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight mb-6 text-amber-50 drop-shadow-2xl flex items-center justify-center gap-4">
            <svg className="w-12 h-12 sm:w-16 sm:h-16" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
              <path d="M7 8h2v2H7zm4-1h2v2h-2zm4 3h2v2h-2z"/>
            </svg>
            PixelPanel 
          </h1>
          <p className="text-base sm:text-lg text-stone-200 drop-shadow-lg">
            Generate your comic story via voice with our AI-powered comic generator agent. 
            Simply speak your ideas and watch them come to life!
          </p>
        </div>
        
        {/* Start button in the middle */}
        <div className="flex justify-center">
          <Link href="/create">
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
