export default defineNuxtRouteMiddleware(async () => {
  const auth = useAuthStore()

  auth.hydrateFromCookie()

  if (!auth.isAuthenticated) {
    return navigateTo('/login')
  }

  if (!auth.admin) {
    try {
      await auth.refreshAdmin()
    } catch {
      return navigateTo('/login')
    }
  }
})
