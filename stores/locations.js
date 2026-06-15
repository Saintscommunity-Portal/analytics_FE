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
      value: country.name,
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

    findCountry(countryValue) {
      return this.countries.find((item) => item.name === countryValue || item.value === countryValue)
    },

    countryName(countryValue) {
      return this.findCountry(countryValue)?.name || countryValue || ''
    },

    stateOptions(countryValue) {
      const country = this.findCountry(countryValue)

      return (country?.states || []).map((state) => ({
        label: state.name,
        value: state.name,
      }))
    },

    subdivisionOptions(countryValue, stateName) {
      const country = this.findCountry(countryValue)
      const state = (country?.states || []).find((item) => item.name === stateName || item.value === stateName)

      return (state?.subdivision || state?.subdivisions || []).map((subdivision) => ({
        label: subdivision.name,
        value: subdivision.name,
      }))
    },
  },
})
