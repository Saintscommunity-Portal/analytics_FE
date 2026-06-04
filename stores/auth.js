import { defineStore } from 'pinia'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: null,
    admin: null,
    entities: {
      churches: null,
      fellowships: null,
      cells: null,
    },
    loading: false,
    error: null,
    initialized: false,
  }),

  getters: {
    isAuthenticated: (state) => Boolean(state.token),
    adminName: (state) => state.admin?.name?.trim() || state.admin?.email || 'Admin User',
    adminInitials() {
      const name = this.adminName.trim()

      if (!name) return 'AU'

      return name
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join('')
    },
  },

  actions: {
    hydrateFromCookie() {
      const tokenCookie = useCookie('analytics_admin_token', {
        sameSite: 'lax',
        default: () => null,
      })
      const adminCookie = useCookie('analytics_admin_user', {
        sameSite: 'lax',
        default: () => null,
      })

      this.token = tokenCookie.value
      this.admin = adminCookie.value
      this.entities = this.normalizeEntities(adminCookie.value?.entities)
    },

    syncCookies() {
      const tokenCookie = useCookie('analytics_admin_token', {
        sameSite: 'lax',
        default: () => null,
      })
      const adminCookie = useCookie('analytics_admin_user', {
        sameSite: 'lax',
        default: () => null,
      })

      tokenCookie.value = this.token
      adminCookie.value = this.admin
    },

    normalizeEntities(entities) {
      return {
        churches: entities?.churches || null,
        fellowships: entities?.fellowships || null,
        cells: entities?.cells || null,
      }
    },

    adminBaseUrl() {
      const config = useRuntimeConfig()

      return `${String(config.public.apiBase).replace(/\/$/, '')}/admin`
    },

    authHeaders() {
      return {
        Accept: 'application/json',
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      }
    },

    async login(credentials) {
      this.loading = true
      this.error = null

      try {
        const response = await $fetch(`${this.adminBaseUrl()}/login`, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
          },
          body: credentials,
        })

        this.token = response?.token || null
        this.admin = response?.admin || null
        this.entities = this.normalizeEntities(this.admin?.entities)
        this.syncCookies()

        await this.refreshAdmin()

        return response
      } catch (error) {
        this.error = error?.data?.message || 'Unable to sign in with those credentials.'
        throw error
      } finally {
        this.loading = false
      }
    },

    async refreshAdmin() {
      if (!this.token) {
        this.initialized = true
        return null
      }

      this.loading = true
      this.error = null

      try {
        const response = await $fetch(`${this.adminBaseUrl()}/me`, {
          method: 'GET',
          headers: this.authHeaders(),
        })
        const admin = response?.data || response

        this.admin = admin
        this.entities = this.normalizeEntities(admin?.entities)
        this.syncCookies()
        this.initialized = true

        return response
      } catch (error) {
        if (error?.statusCode === 401) {
          this.clearSession()
        }

        this.error = error?.data?.message || 'Unable to refresh admin session.'
        this.initialized = true
        throw error
      } finally {
        this.loading = false
      }
    },

    async logout() {
      try {
        if (this.token) {
          await $fetch(`${this.adminBaseUrl()}/logout`, {
            method: 'POST',
            headers: this.authHeaders(),
          })
        }
      } finally {
        this.clearSession()
        await navigateTo('/login')
      }
    },

    clearSession() {
      this.token = null
      this.admin = null
      this.entities = this.normalizeEntities(null)
      this.initialized = true
      this.syncCookies()
    },
  },
})
