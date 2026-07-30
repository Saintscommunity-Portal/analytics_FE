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
      this.entities = this.normalizeEntities(adminCookie.value?.entities, adminCookie.value?.role)
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
      adminCookie.value = this.admin ? this.compactAdmin(this.admin) : null
    },

    compactAdmin(admin) {
      const { entities, ...rest } = admin || {}
      return rest
    },

    hasRequiredHierarchy() {
      const role = String(this.admin?.role || '').trim().toLowerCase()

      if (['admin', 'pastor', 'church_pastor'].includes(role)) {
        return Array.isArray(this.entities?.churches) && this.entities.churches.length > 0
      }

      if (['fellowship_pastor', 'fellowship_leader'].includes(role)) {
        return Array.isArray(this.entities?.fellowships) && this.entities.fellowships.length > 0
      }

      if (role === 'cell_leader') {
        return Array.isArray(this.entities?.cells) && this.entities.cells.length > 0
      }

      return true
    },

    normalizeEntities(entities, role = this.admin?.role) {
      const churches = this.normalizeEntityList(entities?.churches)
      const fellowships = this.normalizeEntityList(entities?.fellowships)
      const cells = this.normalizeEntityList(entities?.cells)
      const normalizedRole = String(role || '').trim().toLowerCase()
      const topChurchRoles = ['admin', 'pastor', 'church_pastor']

      return {
        churches,
        fellowships: topChurchRoles.includes(normalizedRole) && Array.isArray(churches)
          ? null
          : fellowships,
        cells: topChurchRoles.includes(normalizedRole) && Array.isArray(churches)
          ? null
          : cells,
      }
    },

    normalizeEntityList(value) {
      if (!value) return null
      if (Array.isArray(value)) return value
      if (Array.isArray(value?.data)) return value.data

      if (typeof value === 'object') {
        const keys = Object.keys(value)
        const isNumericObject = keys.length > 0 && keys.every((key) => /^\d+$/.test(key))

        if (isNumericObject) {
          return Object.values(value)
        }
      }

      return null
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

    mustChangePassword(admin) {
      return Boolean(admin?.must_change_password || admin?.mustChangePassword)
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

        if (this.mustChangePassword(response?.admin)) {
          this.clearSession()
          this.error = 'Please change Password on admin Portal'
          throw new Error(this.error)
        }

        this.token = response?.token || null
        this.admin = response?.admin || null
        this.entities = this.normalizeEntities(this.admin?.entities, this.admin?.role)
        this.syncCookies()

        await this.refreshAdmin()

        return response
      } catch (error) {
        this.error = this.error || error?.data?.message || 'Unable to sign in with those credentials.'
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
        this.entities = this.normalizeEntities(admin?.entities, admin?.role)
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
