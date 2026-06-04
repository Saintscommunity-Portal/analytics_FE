<script setup>
import { ref } from 'vue'
import AppHeader from '~/components/AppHeader.vue'
import AppSidebar from '~/components/AppSidebar.vue'

const sidebarCollapsed = ref(false)
</script>

<template>
  <div class="min-h-screen bg-gray-50 text-gray-900 lg:flex">
    <component :is="AppSidebar" :collapsed="sidebarCollapsed" />

    <div class="min-w-0 flex-1">
      <component
        :is="AppHeader"
        :sidebar-collapsed="sidebarCollapsed"
        @toggle-sidebar="sidebarCollapsed = !sidebarCollapsed"
      />

      <main class="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
        <slot />
      </main>
    </div>
  </div>
</template>
