// ---------------------------------------------------------------
// App tour: spotlights real elements, one step at a time.
// No library — a dimmed overlay with a "hole" (box-shadow trick)
// around the target, and a card next to it (a bottom sheet on phones).
// Keyboard: → / Enter next, ← back, Esc skip. Focus moves to the card.
// ---------------------------------------------------------------
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';

const PAD = 8;
const MOBILE = 640;
const NAV_COLLAPSED = 820;

const findTarget = (selector) => {
  if (!selector) return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 ? el : null;   // hidden (e.g. collapsed menu) counts as missing
};

export default function Tour({ steps, onClose, setMenuOpen }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState(null);
  const [ready, setReady] = useState(false);
  const elRef = useRef(null);
  const cardRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const step = steps[i];
  const last = i === steps.length - 1;
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const measure = useCallback(() => {
    const el = elRef.current;
    if (!el) return setRect(null);
    const r = el.getBoundingClientRect();
    // Very tall targets: spotlight the top part only, so the card still has room
    const height = Math.min(r.height + PAD * 2, window.innerHeight * 0.55);
    setRect({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height });
  }, []);

  // Go to the step's page, open the phone menu if needed, then wait for the target to appear
  useEffect(() => {
    let cancelled = false;
    setReady(false);
    elRef.current = null;
    setRect(null);
    if (step.route && location.pathname !== step.route) {
      navigate(step.route);
      return undefined;   // effect re-runs when the location changes
    }
    setMenuOpen?.(!!step.menu && window.innerWidth < NAV_COLLAPSED);
    const started = Date.now();
    const poll = () => {
      if (cancelled) return;
      const el = findTarget(step.target);
      if (el || !step.target || Date.now() - started > 2500) {
        elRef.current = el;
        if (el) el.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
        setTimeout(() => { if (!cancelled) { measure(); setReady(true); } }, el ? 350 : 0);
      } else {
        setTimeout(poll, 100);
      }
    };
    poll();
    return () => { cancelled = true; };
  }, [i, step, location.pathname, navigate, setMenuOpen, measure, reduce]);

  // Keep the spotlight on the target while scrolling / resizing
  useEffect(() => {
    const on = () => measure();
    window.addEventListener('resize', on);
    window.addEventListener('scroll', on, true);
    return () => { window.removeEventListener('resize', on); window.removeEventListener('scroll', on, true); };
  }, [measure]);

  const close = useCallback((completed) => {
    setMenuOpen?.(false);
    onClose(completed);
  }, [onClose, setMenuOpen]);

  const next = useCallback(() => (last ? close(true) : setI((n) => n + 1)), [last, close]);
  const back = useCallback(() => setI((n) => Math.max(0, n - 1)), []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') close(false);
      // Enter = next only when the card itself has focus (Enter on Back/Skip must do Back/Skip)
      else if (e.key === 'ArrowRight' || (e.key === 'Enter' && e.target === cardRef.current)) { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft') back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, back, close]);

  useLayoutEffect(() => { if (ready) cardRef.current?.focus(); }, [ready, i]);

  // Card position: next to the target on wide screens; a sheet at the bottom (or top) on phones
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let cardStyle;
  let cardClass = 'tour-card';
  if (!rect) {
    cardClass += ' centered';
  } else if (vw < MOBILE) {
    cardClass += rect.top + rect.height / 2 > vh * 0.55 ? ' sheet top' : ' sheet bottom';
  } else {
    const width = 360;
    const below = vh - (rect.top + rect.height) > 240;
    cardStyle = {
      width,
      left: Math.min(Math.max(12, rect.left), vw - width - 12),
      ...(below ? { top: rect.top + rect.height + 12 } : { bottom: vh - rect.top + 12 }),
    };
  }

  return createPortal(
    <div className="tour-layer" aria-live="polite">
      <div className="tour-blocker" onClick={() => {}} />
      {rect
        ? <div className="tour-spot" style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }} />
        : <div className="tour-dim" />}
      {ready && (
        <div ref={cardRef} className={cardClass} style={cardStyle} role="dialog" aria-modal="true"
          aria-labelledby="tour-title" aria-describedby="tour-body" tabIndex={-1} key={i}>
          {step.emoji && <div className="tour-emoji" aria-hidden="true">{step.emoji}</div>}
          <h3 id="tour-title">{step.title}</h3>
          <p id="tour-body">{step.body}</p>
          <div className="tour-foot">
            <span className="tour-dots" aria-label={`Step ${i + 1} of ${steps.length}`}>
              {steps.map((_, n) => <i key={n} className={n === i ? 'on' : n < i ? 'done' : ''} />)}
            </span>
            <span className="tour-buttons">
              {!last && <button className="link-like small" onClick={() => close(false)}>Skip</button>}
              {i > 0 && <button className="ghost small" onClick={back}>Back</button>}
              <button className="small" onClick={next}>{last ? 'Done' : i === 0 ? 'Show me' : 'Next'}</button>
            </span>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
