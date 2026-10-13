// ---------------------------------------------------------------
// BadEffect.jsx — a DELIBERATELY broken component for teaching.
//
// DEMO SCRIPT:
//   1. Open browser DevTools -> Network tab BEFORE visiting /bad-effect
//   2. Visit the page. Watch requests machine-gun down the screen.
//   3. Say: "Imagine this on a paid API."
//   4. Comment out THE BROKEN VERSION, uncomment THE FIXED VERSION.
//   5. Reload — one request. Silence. Applause.
//
// Two bugs are planted below:
//   BUG 1: useEffect with NO dependency array
//          -> fetch -> setState -> re-render -> effect runs again -> fetch...
//          -> INFINITE REQUEST LOOP
//   BUG 2: setInterval with NO cleanup
//          -> every visit to this page adds ANOTHER timer (zombie timers).
//          Leave the page and come back 3 times = 3 timers hammering the API.
// ---------------------------------------------------------------
import { useEffect, useState } from 'react';
import api from '../api/axios';



export default function BadEffect() {
  const [notes, setNotes] = useState([]);
  const [tick, setTick] = useState(0);

  // ================= THE BROKEN VERSION =================
  // BUG 1: no dependency array — runs after EVERY render.
  // setNotes causes a render, which runs the effect, which calls
  // setNotes... welcome to the infinite loop.
  useEffect(() => {
    api.get('/notes').then((r) => setNotes(r.data.notes));
  });

  // BUG 2: interval with no cleanup — a zombie timer survives
  // after you leave the page. Visit 3 times = 3 timers running.
  useEffect(() => {
    setInterval(() => setTick((t) => t + 1), 3000);
  }, []);
  // =======================================================

  // ================== THE FIXED VERSION ==================
  // (comment the block above, uncomment this one, reload)
  //
  // FIX 1: [] dependency array -> fetch exactly once on mount.
  // useEffect(() => {
  //   api.get('/notes').then((r) => setNotes(r.data.notes));
  // }, []);
  //
  // FIX 2: return a cleanup function -> React clears the timer
  // when you leave the page (and between StrictMode's double-run).
  // useEffect(() => {
  //   const id = setInterval(() => setTick((t) => t + 1), 3000);
  //   return () => clearInterval(id);
  // }, []);
  // =======================================================

  return (
    <div className="card">
      <h2>useEffect crime scene 🚨</h2>
      <p className="error">
        Open the Network tab. Count the requests. Then read the comments in
        this file and fix both bugs.
      </p>
      <p className="muted">Interval ticks: {tick} · Notes loaded: {notes.length}</p>
      <p>
        The rule: an effect must be safe to re-run, and cleanup is how you
        make it safe. React StrictMode runs effects twice in dev to test
        exactly this.
      </p>
    </div>
  );
}
