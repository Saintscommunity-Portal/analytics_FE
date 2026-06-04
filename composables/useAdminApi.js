export function useAdminApi() {
  const config = useRuntimeConfig()
  const token = useCookie('analytics_admin_token', {
    sameSite: 'lax',
    default: () => null,
  })

  const baseUrl = computed(() => {
    return `${String(config.public.apiBase).replace(/\/$/, '')}/admin`
  })

  async function request(path, options = {}) {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`

    try {
      return await $fetch(`${baseUrl.value}${normalizedPath}`, {
        ...options,
        headers: {
          Accept: 'application/json',
          ...(options.headers || {}),
          ...(token.value ? { Authorization: `Bearer ${token.value}` } : {}),
        },
      })
    } catch (error) {
      if (error?.statusCode === 401) {
        token.value = null
        const auth = useAuthStore()
        auth.clearSession()
      }

      throw error
    }
  }

  return {
    baseUrl: readonly(baseUrl),
    request,
  }
}
