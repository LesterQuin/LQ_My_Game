import React from 'react';
import { Info, CheckCircle2, AlertCircle } from 'lucide-react';

export function Toast({ toast }) {
  if (!toast) return null;

  const { message, type = 'info' } = toast;

  return (
    <div className={`toast-container toast-${type}`}>
      {type === 'success' && <CheckCircle2 size={18} />}
      {type === 'error' && <AlertCircle size={18} />}
      {type === 'info' && <Info size={18} />}
      <span>{message}</span>
    </div>
  );
}
