"use client";

import React from 'react';
import { Modal } from './Modal';

interface ConfirmDialogProps {
  title?: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isConfirming?: boolean;
  confirmButtonStyle?: 'default' | 'danger';
}

export default function ConfirmDialog({
  title = 'Please Confirm',
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isOpen,
  onConfirm,
  onCancel,
  isConfirming = false,
  confirmButtonStyle = 'default',
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <Modal onClose={onCancel}>
      <div className="w-[420px] p-6 bg-background-card">
        <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
        <div className="text-sm text-foreground-secondary mb-6">{message}</div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={isConfirming}
            className="px-4 py-2 rounded-lg border border-border bg-background-secondary text-foreground hover:bg-background-tertiary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={isConfirming}
            className={`px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              confirmButtonStyle === 'danger'
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-accent text-foreground-inverse hover:bg-accent-hover'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
}


