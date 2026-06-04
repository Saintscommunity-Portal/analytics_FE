export default defineNuxtRouteMiddleware(() => {
  const auth = useAuthStore()

  auth.hydrateFromCookie()

  if (auth.isAuthenticated) {
    return navigateTo('/dashboard')
  }
})
