import { create } from 'zustand';

function safeGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    return;
  }
}

const useTourStore = create((set, get) => ({
  isOpen: false,
  stepIndex: 0,
  steps: [],
  storageKey: null,
  openTour: ({ steps, storageKey }) => {
    set({
      isOpen: true,
      stepIndex: 0,
      steps: Array.isArray(steps) ? steps : [],
      storageKey: storageKey || null
    });
  },
  closeTour: () => set({ isOpen: false }),
  markSeenAndClose: () => {
    const key = get().storageKey;
    if (key) safeSet(key, '1');
    set({ isOpen: false });
  },
  next: () =>
    set((s) => {
      const total = Array.isArray(s.steps) ? s.steps.length : 0;
      if (total <= 0) return { isOpen: false };
      const nextIndex = Math.min(s.stepIndex + 1, total - 1);
      return { stepIndex: nextIndex };
    }),
  prev: () => set((s) => ({ stepIndex: Math.max(0, s.stepIndex - 1) })),
  goTo: (index) =>
    set((s) => {
      const total = Array.isArray(s.steps) ? s.steps.length : 0;
      const v = typeof index === 'number' ? index : 0;
      const clamped = Math.max(0, Math.min(v, Math.max(0, total - 1)));
      return { stepIndex: clamped };
    }),
  hasSeen: (storageKey) => Boolean(storageKey && safeGet(storageKey))
}));

export default useTourStore;
