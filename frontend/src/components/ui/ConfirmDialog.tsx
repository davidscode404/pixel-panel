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
}

export default function ConfirmDialog({
  title = 'Please Confirm',
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isOpen,
  onConfirm,
  onCancel,
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
            className="px-4 py-2 rounded-lg border border-border bg-background-secondary text-foreground hover:bg-background-tertiary transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg bg-accent text-foreground-inverse hover:bg-accent-hover transition-colors"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
}


