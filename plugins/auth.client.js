export default defineNuxtPlugin(async () => {
  const auth = useAuthStore()

  auth.hydrateFromCookie()

  if (auth.token) {
    try {
      await auth.refreshAdmin()
    } catch {
      auth.clearSession()
    }
  } else {
    auth.initialized = true
  }
})
