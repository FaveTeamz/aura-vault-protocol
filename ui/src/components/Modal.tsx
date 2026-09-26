/**
 * Modal — Issue #1004
 *
 * Accessible modal dialog satisfying WCAG 2.1 criteria 2.1.1 and 2.1.2:
 * - Focus trap via useFocusTrap: Tab/Shift+Tab cycle within the dialog
 * - Escape key closes the modal
 * - Focus is restored to the trigger element on close
 * - role="dialog" + aria-modal="true" + aria-labelledby for screen readers
 * - Backdrop click closes the modal; backdrop is aria-hidden
 * - No focus ever reaches elements behind the open modal
 */

import { useRef } from "react";
import { createPortal } from "react-dom";
import { useFocusTrap } from "../lib/useFocusTrap";

interface ModalProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Optional id for the title element (auto-generated if omitted) */
  titleId?: string;
}

export function Modal({ isOpen, title, onClose, children, titleId = "modal-title" }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Issue #1004: full focus trap — Tab cycles within modal, focus restored on close
  useFocusTrap(dialogRef, isOpen);

  if (!isOpen) return null;

  return createPortal(
    <>
      {/* Inert backdrop — clicks close the modal but it is invisible to AT */}
      <div
        className="modal-backdrop"
        aria-hidden="true"
        onClick={onClose}
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="modal"
        // tabIndex needed so the container itself is focusable when no
        // focusable children exist yet (e.g. loading state)
        tabIndex={-1}
        // Prevent backdrop clicks from propagating through the dialog
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            onClose();
          }
        }}
      >
        <div className="modal-header">
          <h2 id={titleId} className="modal-title">{title}</h2>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close dialog"
          >
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </>,
    document.body
  );
}

export default Modal;
