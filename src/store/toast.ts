import { create } from 'zustand';

interface ToastState {
  message: string | null;
  showToast: (message: string) => void;
  hideToast: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
  message: null,
  showToast: (message) => {
    set({ message });
    setTimeout(() => {
      set({ message: null });
    }, 3000);
  },
  hideToast: () => set({ message: null }),
}));
