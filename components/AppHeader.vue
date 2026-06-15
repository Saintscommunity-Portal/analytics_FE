<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps({
  sidebarCollapsed: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['toggle-sidebar'])
const auth = useAuth()
const { isDark, toggleTheme, initTheme } = useThemeMode()
const userMenu = ref()
const now = ref(new Date())
let timer = null

const currentTime = computed(() => {
  return new Intl.DateTimeFormat('en-NG', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(now.value)
})

const currentDate = computed(() => {
  return new Intl.DateTimeFormat('en-NG', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  }).format(now.value)
})

const adminRole = computed(() => {
  const role = auth.admin.value?.role || 'admin'
  return String(role).replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
})

const menuItems = computed(() => [
  {
    label: 'User profile',
    icon: 'pi pi-user',
    command: () => {},
  },
  {
    label: 'Profile settings',
    icon: 'pi pi-cog',
    command: () => {},
  },
  {
    label: 'App settings',
    icon: 'pi pi-sliders-h',
    command: () => {},
  },
  {
    separator: true,
  },
  {
    label: 'Logout',
    icon: 'pi pi-sign-out',
    command: () => auth.logout(),
  },
])

function toggleMenu(event) {
  userMenu.value.toggle(event)
}

onMounted(() => {
  initTheme()
  timer = window.setInterval(() => {
    now.value = new Date()
  }, 1000)
})

onBeforeUnmount(() => {
  if (timer) window.clearInterval(timer)
})
</script>

<template>
  <header class="sticky top-0 z-20 border-b border-gray-200 bg-white/95 backdrop-blur transition-colors dark:border-gray-800 dark:bg-gray-950/95">
    <div class="flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
      <div class="flex items-center gap-3">
        <Button
          :aria-label="props.sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
          icon="pi pi-bars"
          severity="secondary"
          text
          rounded
          @click="emit('toggle-sidebar')"
        />
        <div>
          <p class="m-0 text-sm font-semibold text-gray-950 dark:text-white">Analytics Dashboard</p>
          <p class="m-0 text-xs text-gray-500 dark:text-gray-400">Admin workspace</p>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <div class="hidden rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-right dark:border-gray-800 dark:bg-gray-900 sm:block">
          <p class="m-0 text-xs font-medium text-gray-500 dark:text-gray-400">{{ currentDate }}</p>
          <p class="m-0 text-sm font-semibold text-gray-900 dark:text-white">{{ currentTime }}</p>
        </div>

        <button
          type="button"
          class="grid h-10 w-10 place-items-center rounded-xl border border-gray-200 bg-white text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-4 focus:ring-[#a83632]/30 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
          :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
          :title="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
          @click="toggleTheme"
        >
          <i :class="isDark ? 'pi pi-sun' : 'pi pi-moon'" />
        </button>

        <button
          class="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-1.5 pr-3 text-left transition hover:bg-gray-50 focus:outline-none focus:ring-4 focus:ring-[#a83632]/30 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800"
          type="button"
          aria-haspopup="menu"
          @click="toggleMenu"
        >
          <Avatar
            :label="auth.adminInitials.value"
            shape="circle"
            class="bg-[#a83632] text-white"
          />
          <span class="hidden sm:block">
            <span class="block max-w-36 truncate text-sm font-semibold text-gray-950 dark:text-white">
              {{ auth.adminName.value }}
            </span>
            <span class="block text-xs text-gray-500 dark:text-gray-400">{{ adminRole }}</span>
          </span>
          <i class="pi pi-angle-down text-xs text-gray-400 dark:text-gray-500" />
        </button>

        <Menu ref="userMenu" :model="menuItems" popup />
      </div>
    </div>
  </header>
</template>
