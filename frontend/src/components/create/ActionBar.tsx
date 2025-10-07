"use client";

interface ActionBarProps {
  onCreate: () => void;
}

export default function ActionBar({ onCreate }: ActionBarProps) {
  return (
    <div className="flex-shrink-0 p-2 sm:p-4 flex justify-end items-center">
      <div className="flex items-center gap-2">
        <button
          onClick={onCreate}
          className="group rounded-lg border border-solid transition-all duration-300 flex items-center justify-center gap-2 backdrop-blur-sm font-medium text-sm h-10 px-4 sm:px-6 shadow-xl hover:shadow-2xl hover:scale-105"
          style={{
            backgroundColor: 'var(--accent)',
            borderColor: 'var(--accent)',
            color: 'var(--foreground-inverse)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--accent-hover)'
            e.currentTarget.style.borderColor = 'var(--accent-hover)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--accent)'
            e.currentTarget.style.borderColor = 'var(--accent)'
          }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
          </svg>
          <span className="hidden sm:inline">Create Comic</span>
          <span className="sm:hidden">Create</span>
        </button>
      </div>
    </div>
  );
}


