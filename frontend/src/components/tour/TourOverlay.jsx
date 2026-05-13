import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '../../i18n/useT';
import useTourStore from '../../store/useTourStore';

function clamp(v, min, max) {
  return Math.max(min, Math.min(v, max));
}

function safeQuerySelector(selector) {
  if (!selector) return null;
  try {
    return document.querySelector(selector);
  } catch {
    return null;
  }
}

function computePlacement(targetRect) {
  if (!targetRect) return 'center';
  const vw = window.innerWidth || 0;
  const vh = window.innerHeight || 0;
  const leftSpace = targetRect.left;
  const rightSpace = vw - targetRect.right;
  const topSpace = targetRect.top;
  const bottomSpace = vh - targetRect.bottom;
  const bestSide = [
    { k: 'right', v: rightSpace },
    { k: 'left', v: leftSpace },
    { k: 'bottom', v: bottomSpace },
    { k: 'top', v: topSpace }
  ].sort((a, b) => b.v - a.v)[0]?.k;
  return bestSide || 'right';
}

export default function TourOverlay() {
  const { t } = useT();
  const { isOpen, steps, stepIndex, next, prev, markSeenAndClose, closeTour, navigator } = useTourStore((s) => ({
    isOpen: s.isOpen,
    steps: s.steps,
    stepIndex: s.stepIndex,
    next: s.next,
    prev: s.prev,
    markSeenAndClose: s.markSeenAndClose,
    closeTour: s.closeTour,
    navigator: s.navigator
  }));

  const step = Array.isArray(steps) ? steps[stepIndex] : null;
  const total = Array.isArray(steps) ? steps.length : 0;
  const tooltipRef = useRef(null);
  const lastHighlightedElRef = useRef(null);
  const [targetEl, setTargetEl] = useState(null);
  const [targetRect, setTargetRect] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0, placement: 'center' });

  const hasNext = stepIndex < total - 1;
  const hasPrev = stepIndex > 0;

  useEffect(() => {
    if (!isOpen) return;
    const selector = String(step?.selector || '').trim();
    if (!selector) {
      setTargetEl(null);
      return;
    }

    let alive = true;
    const update = () => {
      if (!alive) return;
      const el = safeQuerySelector(selector);
      setTargetEl((prev) => (prev === el ? prev : el));
    };

    update();
    let tries = 0;
    const intervalId = window.setInterval(() => {
      tries += 1;
      update();
      if (tries >= 40) window.clearInterval(intervalId);
    }, 100);

    return () => {
      alive = false;
      window.clearInterval(intervalId);
    };
  }, [isOpen, stepIndex, step?.selector]);

  const recalc = useCallback(() => {
    if (!isOpen) return;
    const tooltip = tooltipRef.current;
    const ttRect = tooltip?.getBoundingClientRect?.() || { width: 340, height: 180 };
    const rect = targetEl?.getBoundingClientRect?.() || null;
    const placement = computePlacement(rect);

    const vw = window.innerWidth || 0;
    const vh = window.innerHeight || 0;
    const pad = 16;
    const gap = 12;

    let top = (vh - ttRect.height) / 2;
    let left = (vw - ttRect.width) / 2;

    if (rect && placement !== 'center') {
      if (placement === 'right') {
        left = rect.right + gap;
        top = rect.top;
      } else if (placement === 'left') {
        left = rect.left - ttRect.width - gap;
        top = rect.top;
      } else if (placement === 'bottom') {
        left = rect.left;
        top = rect.bottom + gap;
      } else if (placement === 'top') {
        left = rect.left;
        top = rect.top - ttRect.height - gap;
      }
    }

    left = clamp(left, pad, Math.max(pad, vw - ttRect.width - pad));
    top = clamp(top, pad, Math.max(pad, vh - ttRect.height - pad));

    setTooltipPos({ top, left, placement });
    setTargetRect(rect);
  }, [isOpen, targetEl]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    const el = targetEl;
    if (!el || !el.scrollIntoView) return;
    const rect = el.getBoundingClientRect();
    const isVisible = rect.top >= 0 && rect.left >= 0 && rect.bottom <= (window.innerHeight || 0) && rect.right <= (window.innerWidth || 0);
    if (!isVisible) el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  }, [isOpen, targetEl, stepIndex]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    recalc();
  }, [isOpen, stepIndex, recalc]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    recalc();
  }, [isOpen, targetEl, recalc]);

  useEffect(() => {
    if (!isOpen) return;
    const onResize = () => recalc();
    const onScroll = () => recalc();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [isOpen, recalc]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeTour();
        return;
      }
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault();
        if (hasNext) next();
        else markSeenAndClose();
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (hasPrev) prev();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, hasNext, hasPrev, next, prev, markSeenAndClose, closeTour]);

  useEffect(() => {
    if (!isOpen || !step) return;
    const actions = Array.isArray(step.action) ? step.action : step.action ? [step.action] : [];
    actions.forEach((a) => {
      if (!a) return;
      if (a.type === 'navigate' && typeof navigator === 'function' && a.to) {
        try {
          navigator(String(a.to), a.options || undefined);
        } catch {
          return;
        }
        return;
      }
      try {
        window.dispatchEvent(new CustomEvent('ac_tour_action', { detail: a }));
      } catch {
        return;
      }
    });

    if (step.navigateTo && typeof navigator === 'function') {
      try {
        navigator(String(step.navigateTo), step.navigateOptions || undefined);
      } catch {
        return;
      }
    }

    const focusSelector = typeof step.focusSelector === 'string' && step.focusSelector.trim() ? step.focusSelector.trim() : null;
    const shouldFocusTarget = Boolean(step.focus) && !focusSelector;
    const selectorToFocus = focusSelector || (shouldFocusTarget ? step.selector : null);
    if (!selectorToFocus) return;
    const timeout = window.setTimeout(() => {
      try {
        const el = document.querySelector(selectorToFocus);
        if (el && typeof el.focus === 'function') el.focus();
      } catch {
        return;
      }
    }, 50);
    return () => window.clearTimeout(timeout);
  }, [isOpen, stepIndex, step, navigator]);

  useEffect(() => {
    const prev = lastHighlightedElRef.current;
    if (prev && prev !== targetEl) {
      try {
        prev.removeAttribute('data-tour-active');
      } catch {
        void 0;
      }
    }

    if (isOpen && targetEl) {
      try {
        targetEl.setAttribute('data-tour-active', '1');
      } catch {
        void 0;
      }
      lastHighlightedElRef.current = targetEl;
    }

    if (!isOpen) {
      if (prev) {
        try {
          prev.removeAttribute('data-tour-active');
        } catch {
          void 0;
        }
      }
      lastHighlightedElRef.current = null;
      setTargetEl(null);
      setTargetRect(null);
    }
  }, [isOpen, targetEl]);

  if (!isOpen || !step) return null;

  const highlightStyle =
    targetRect && tooltipPos.placement !== 'center'
      ? {
          top: Math.max(0, targetRect.top - 6),
          left: Math.max(0, targetRect.left - 6),
          width: Math.max(0, targetRect.width + 12),
          height: Math.max(0, targetRect.height + 12)
        }
      : null;

  const overlay = (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-[1px]" onClick={closeTour} />
      {highlightStyle ? (
        <div
          className="pointer-events-none absolute rounded-2xl ring-2 ring-brand-300 shadow-[0_0_0_6px_rgba(99,102,241,0.18)]"
          style={highlightStyle}
        />
      ) : null}
      <div
        className="absolute w-[340px] max-w-[calc(100vw-32px)]"
        style={{ top: tooltipPos.top, left: tooltipPos.left }}
        role="dialog"
        aria-modal="true"
      >
        <div ref={tooltipRef} className="ac-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                {t('tourStep', { current: stepIndex + 1, total })}
              </div>
              <div className="mt-1 text-sm font-semibold text-zinc-900">{step.title}</div>
            </div>
            <button type="button" className="ac-btn ac-btn-soft px-3 py-2 text-xs" onClick={markSeenAndClose}>
              {t('tourSkip')}
            </button>
          </div>
          {step.body ? <div className="mt-2 text-sm text-zinc-700">{step.body}</div> : null}
          <div className="mt-4 flex items-center justify-between gap-2">
            <button type="button" className="ac-btn ac-btn-soft px-3 py-2 text-xs" onClick={hasPrev ? prev : undefined} disabled={!hasPrev}>
              {t('tourBack')}
            </button>
            <button
              type="button"
              className="ac-btn ac-btn-primary px-3 py-2 text-xs"
              onClick={() => {
                if (hasNext) next();
                else markSeenAndClose();
              }}
            >
              {hasNext ? t('tourNext') : t('tourDone')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
