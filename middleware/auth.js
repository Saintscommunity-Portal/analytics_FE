export default defineNuxtRouteMiddleware(async () => {
  const auth = useAuthStore()

  auth.hydrateFromCookie()

  if (!auth.isAuthenticated) {
    return navigateTo('/login')
  }

  if (!auth.admin || !auth.initialized || !auth.hasRequiredHierarchy()) {
    try {
      await auth.refreshAdmin()
    } catch {
      return navigateTo('/login')
    }
  }
})
