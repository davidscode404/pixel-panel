import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8 sm:p-12">
      <main className="flex flex-col items-center text-center gap-6 max-w-2xl">
        <h1 className="text-4xl sm:text-6xl font-bold tracking-tight">
          Ultimate Agents
        </h1>
        <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400">
          Build, orchestrate, and launch AI agents in minutes. This is a
          placeholder subtitle for your landing page.
        </p>
        <Link href="/create">
          <button className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-background hover:bg-[#383838] dark:hover:bg-[#ccc] font-medium text-base h-12 px-8">
            Start
          </button>
        </Link>
      </main>
    </div>
  );
}
