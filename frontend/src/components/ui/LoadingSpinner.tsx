interface LoadingSpinnerProps {
  message?: string;
  fullPage?: boolean;
}

export default function LoadingSpinner({ message = 'Loading...', fullPage = false }: LoadingSpinnerProps) {
  if (fullPage) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--background)' }}>
        <div className="flex items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--accent)' }}></div>
          <span style={{ color: 'var(--foreground-secondary)' }}>{message}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center py-12">
      <div className="flex items-center gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--accent)' }}></div>
        <span style={{ color: 'var(--foreground-secondary)' }}>{message}</span>
      </div>
    </div>
  );
}

