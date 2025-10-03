'use client';

import { useParams } from 'next/navigation';

export default function EditComicPage() {
  const params = useParams();
  const comicId = params.comicId as string;

  return (
    <div className="h-full flex items-center justify-center" style={{ backgroundColor: 'var(--background)' }}>
      <div className="text-center max-w-md mx-auto p-8">
        <div className="mb-6">
          <div className="w-16 h-16 mx-auto mb-4 bg-yellow-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Edit Comic</h1>
          <p className="text-foreground-secondary">
            Comic ID: <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">{comicId}</span>
          </p>
        </div>
        
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-yellow-800 mb-2">Not Implemented Yet</h2>
          <p className="text-yellow-700 text-sm leading-relaxed">
            The edit functionality is currently being refactored from the create page into a dedicated edit page. 
            This will provide a better user experience with proper URL structure and focused functionality.
          </p>
        </div>

        <div className="space-y-3">
          <a 
            href="/protected/create" 
            className="block w-full bg-accent text-accent-foreground py-3 px-4 rounded-lg font-medium hover:bg-accent/90 transition-colors"
          >
            Go to Create Page
          </a>
          <a 
            href="/protected/comics" 
            className="block w-full bg-gray-100 text-gray-700 py-3 px-4 rounded-lg font-medium hover:bg-gray-200 transition-colors"
          >
            View My Comics
          </a>
        </div>

        <div className="mt-8 text-xs text-foreground-muted">
          <p>Future implementation will include:</p>
          <ul className="mt-2 space-y-1 text-left">
            <li>• Load existing comic data</li>
            <li>• Pre-populate drawing interface</li>
            <li>• Update comic functionality</li>
            <li>• Proper URL structure (/edit/[comicId])</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
