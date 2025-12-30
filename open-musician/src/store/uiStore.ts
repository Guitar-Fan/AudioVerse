import { create } from 'zustand'

type ThemeOption = 'dark' | 'light'

type UIState = {
  theme: ThemeOption
  sidebarOpen: boolean
  setTheme: (theme: ThemeOption) => void
  toggleSidebar: () => void
}

export const useUIStore = create<UIState>((set) => ({
  theme: 'dark',
  sidebarOpen: true,
  setTheme: (theme) => set({ theme }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
}))
