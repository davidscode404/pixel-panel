"use client";

import React from 'react';

type AlertType = 'error' | 'warning' | 'info' | 'success';

interface AlertBannerProps {
  type?: AlertType;
  message: React.ReactNode;
  onClose?: () => void;
  className?: string;
}

const styleByType: Record<AlertType, { container: string; icon: React.ReactNode }> = {
  error: {
    container: 'bg-error/10 border-error/20 text-error',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M4.93 4.93l14.14 14.14" />
      </svg>
    )
  },
  warning: {
    container: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M4.93 4.93l14.14 14.14" />
      </svg>
    )
  },
  info: {
    container: 'bg-blue-50 border-blue-200 text-blue-800',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01" />
      </svg>
    )
  },
  success: {
    container: 'bg-green-50 border-green-200 text-green-800',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    )
  }
};

export default function AlertBanner({ type = 'error', message, onClose, className = '' }: AlertBannerProps) {
  const styles = styleByType[type];
  return (
    <div className={`w-full rounded-lg border px-4 py-3 flex items-start gap-3 ${styles.container} ${className}`}>
      <div className="mt-0.5">{styles.icon}</div>
      <div className="text-sm flex-1">{message}</div>
      {onClose && (
        <button
          onClick={onClose}
          className="ml-2 text-current/70 hover:text-current transition-colors"
          aria-label="Close alert"
        >
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      )}
    </div>
  );
}


