const themeMode = ref('light')
const initialized = ref(false)

function applyTheme(mode) {
  if (!import.meta.client) return

  document.documentElement.classList.toggle('dark', mode === 'dark')
  document.documentElement.style.colorScheme = mode
  window.localStorage.setItem('analytics_theme_mode', mode)
}

export function useThemeMode() {
  const isDark = computed(() => themeMode.value === 'dark')

  function initTheme() {
    if (!import.meta.client || initialized.value) return

    const stored = window.localStorage.getItem('analytics_theme_mode')
    const preferred = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    themeMode.value = stored || preferred
    applyTheme(themeMode.value)
    initialized.value = true
  }

  function setTheme(mode) {
    themeMode.value = mode === 'dark' ? 'dark' : 'light'
    applyTheme(themeMode.value)
  }

  function toggleTheme() {
    setTheme(isDark.value ? 'light' : 'dark')
  }

  return {
    themeMode: readonly(themeMode),
    isDark: readonly(isDark),
    initTheme,
    setTheme,
    toggleTheme,
  }
}
