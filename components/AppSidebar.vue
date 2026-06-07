<script setup>
defineProps({
  collapsed: {
    type: Boolean,
    default: false,
  },
})

const menuItems = [
  {
    label: 'Dashboard',
    to: '/dashboard',
    icon: 'pi pi-chart-line',
  },
  {
    label: 'Workers',
    to: '/workers',
    icon: 'pi pi-users',
  },
  {
    label: 'My Members',
    to: '/members',
    icon: 'pi pi-id-card',
  },
  {
    label: 'Prayer Group',
    to: '/prayer-group',
    icon: 'pi pi-heart',
  },
  {
    label: 'Study Group',
    to: '/study-group',
    icon: 'pi pi-book',
  },
  {
    label: 'Church Meetings',
    to: '/church-meetings',
    icon: 'pi pi-calendar',
  },
  {
    label: 'Outreach',
    to: '/outreaches',
    icon: 'pi pi-send',
  },
  {
    label: 'Follow Ups',
    to: '/followups',
    icon: 'pi pi-comments',
  },
]
</script>

<template>
  <aside
    :class="[
      'hidden min-h-screen shrink-0 border-r border-gray-200 bg-white transition-all duration-200 lg:flex lg:flex-col',
      collapsed ? 'w-20' : 'w-72',
    ]"
  >
    <div class="flex h-16 items-center gap-3 border-b border-gray-100 px-4">
      <div class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#a83632] text-sm font-bold text-white">
        SCC
      </div>
      <div v-if="!collapsed" class="min-w-0">
        <p class="m-0 truncate text-sm font-semibold text-gray-950">SCC Analytics</p>
        <p class="m-0 truncate text-xs text-gray-500">Admin portal</p>
      </div>
    </div>

    <nav class="flex-1 space-y-1 px-3 py-4" aria-label="Main navigation">
      <NuxtLink
        v-for="item in menuItems"
        :key="item.to"
        :to="item.to"
        class="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-600 no-underline transition hover:bg-gray-50 hover:text-gray-950"
        active-class="!bg-[#a83632]/10 !text-[#a83632]"
      >
        <i :class="[item.icon, 'text-base']" />
        <span v-if="!collapsed" class="truncate">{{ item.label }}</span>
      </NuxtLink>
    </nav>
  </aside>
</template>
