import { storeToRefs } from 'pinia'

export function useAuth() {
  const store = useAuthStore()
  const refs = storeToRefs(store)

  return {
    token: readonly(refs.token),
    admin: readonly(refs.admin),
    entities: readonly(refs.entities),
    adminName: refs.adminName,
    adminInitials: refs.adminInitials,
    loading: readonly(refs.loading),
    error: readonly(refs.error),
    initialized: readonly(refs.initialized),
    isAuthenticated: refs.isAuthenticated,
    login: store.login,
    logout: store.logout,
    refreshAdmin: store.refreshAdmin,
    clearSession: store.clearSession,
  }
}
