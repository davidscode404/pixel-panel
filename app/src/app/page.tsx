import BookSlider from '../components/BookSlider';

export default function Home() {
  return (
    <div className="min-h-screen p-8 sm:p-12">
      <main className="flex flex-col items-center gap-12">
        <div className="text-center max-w-2xl">
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight mb-6">
            PixelPanel 
          </h1>
          <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400 mb-8">
            Build, orchestrate, and launch AI agents in minutes. This is a
            placeholder subtitle for your landing page.
          </p>
          <button className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-background hover:bg-[#383838] dark:hover:bg-[#ccc] font-medium text-base h-12 px-8">
            Start
          </button>
        </div>
        
        <BookSlider />
      </main>
    </div>
  );
}
