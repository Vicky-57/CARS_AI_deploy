import { useEffect, useRef } from 'react';
import { Trash2, AlertTriangle, ArrowRight, X } from 'lucide-react';

/**
 * ConfirmDialog — uses the app's exact CSS classes and design tokens.
 * variant: 'danger' | 'warning' | 'info'
 */
export default function ConfirmDialog({
  open,
  title = 'Are you sure?',
  message,
  detail,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}) {
  const confirmBtnRef = useRef(null);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => confirmBtnRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onCancel?.(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onCancel]);

  if (!open) return null;

  const iconMap = {
    danger: Trash2,
    warning: AlertTriangle,
    info: ArrowRight,
  };
  const Icon = iconMap[variant] || Trash2;

  // detail box colours pulled from theme tokens
  const detailStyle = {
    danger: {
      bg: 'var(--status-red-bg)',
      border: 'var(--status-red-border)',
      color: 'var(--status-red-text)',
    },
    warning: {
      bg: 'var(--status-amber-bg)',
      border: 'var(--status-amber-border)',
      color: 'var(--status-amber-text)',
    },
    info: {
      bg: 'var(--bg-surface-subtle)',
      border: 'var(--border)',
      color: 'var(--text-secondary)',
    },
  }[variant] || {};

  return (
    <div
      className="modal-overlay"
      style={{ zIndex: 10000 }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel?.(); }}
    >
      <div
        className="modal"
        style={{ maxWidth: 380 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cd-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon
              size={15}
              color={variant === 'danger' ? 'var(--danger)' : variant === 'warning' ? 'var(--warning)' : 'var(--primary)'}
              strokeWidth={2.2}
            />
            <span className="modal-title" id="cd-title">{title}</span>
          </div>
          <button className="btn-icon" onClick={onCancel} aria-label="Close">
            <X size={15} />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {message && (
            <p style={{
              margin: 0,
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.6,
            }}>
              {message}
            </p>
          )}

          {detail && (
            <div style={{
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              background: detailStyle.bg,
              border: `1px solid ${detailStyle.border}`,
              fontSize: '0.8rem',
              color: detailStyle.color,
              lineHeight: 1.5,
            }}>
              {detail}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="modal-footer">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>

          <button
            ref={confirmBtnRef}
            type="button"
            className="btn btn-primary"
            onClick={onConfirm}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Icon size={13} strokeWidth={2.5} />
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
