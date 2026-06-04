export const useLocationsStore = defineStore('locations', {
  state: () => ({
    countries: [],
    loading: false,
    loaded: false,
    error: '',
  }),

  getters: {
    countryOptions: (state) => state.countries.map((country) => ({
      label: country.name,
      value: country.value,
    })),
  },

  actions: {
    async fetchCountries() {
      if (this.loaded || this.loading) {
        return
      }

      const config = useRuntimeConfig()
      this.loading = true
      this.error = ''

      try {
        const response = await $fetch('/shared/countries', {
          baseURL: config.public.apiBase,
          headers: {
            Accept: 'application/json',
          },
        })

        this.countries = Array.isArray(response?.data) ? response.data : []
        this.loaded = true
      } catch (error) {
        this.error = error?.data?.message || error?.message || 'Unable to load countries.'
      } finally {
        this.loading = false
      }
    },

    stateOptions(countryCode) {
      const country = this.countries.find((item) => item.value === countryCode)

      return (country?.states || []).map((state) => ({
        label: state.name,
        value: state.value,
      }))
    },

    subdivisionOptions(countryCode, stateName) {
      const country = this.countries.find((item) => item.value === countryCode)
      const state = (country?.states || []).find((item) => item.value === stateName)

      return (state?.subdivision || state?.subdivisions || []).map((subdivision) => ({
        label: subdivision.name,
        value: subdivision.value,
      }))
    },
  },
})
