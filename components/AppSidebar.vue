<script setup>
defineProps({
  collapsed: {
    type: Boolean,
    default: false,
  },
});

const auth = useAuthStore();
const route = useRoute();

const menuItems = computed(() => [
  {
    label: "Dashboard",
    to: "/dashboard",
    icon: "pi pi-chart-line",
  },
  {
    label: "Workers",
    to: "/workers",
    icon: "pi pi-users",
  },
  {
    label: "My Members",
    to: "/members",
    icon: "pi pi-id-card",
  },
  {
    label: "Prayer Group",
    to: "/prayer-group",
    icon: "pi pi-heart",
  },
  {
    label: "Study Group",
    to: "/study-group",
    icon: "pi pi-book",
  },
  {
    label: "Church Meetings",
    to: "/church-meetings",
    icon: "pi pi-calendar",
  },
  {
    label: "Outreach",
    to: "/outreaches",
    icon: "pi pi-send",
  },
  {
    label: "Follow Ups",
    to: "/followups",
    icon: "pi pi-comments",
  },
  ...(auth.admin?.role === "admin"
    ? [
        {
          label: "Developer",
          icon: "pi pi-wrench",
          children: [
            {
              label: "Queue Digest Test",
              to: "/developer",
              icon: "pi pi-envelope",
            },
            {
              label: "Job Schedules",
              to: "/developer/job-schedules",
              icon: "pi pi-clock",
            },
            {
              label: "Meeting Types",
              to: "/church-meetings/types",
              icon: "pi pi-list",
            },
          ],
        },
      ]
    : []),
]);

function isGroupActive(item) {
  return (item.children || []).some(
    (child) => route.path === child.to || route.path.startsWith(`${child.to}/`),
  );
}
</script>

<template>
  <aside
    :class="[
      'hidden min-h-screen shrink-0 border-r border-gray-200 bg-white transition-all duration-200 dark:border-gray-800 dark:bg-gray-950 lg:flex lg:flex-col',
      collapsed ? 'w-20' : 'w-72',
    ]"
  >
    <div
      class="flex h-16 items-center gap-3 border-b border-gray-100 px-4 dark:border-gray-800"
    >
      <div
        v-if="collapsed"
        class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#a83632] text-sm font-bold text-white"
      >
        SCC
      </div>
      <div v-else class="min-w-0">
        <p
          class="m-0 text-sm font-semibold leading-tight text-gray-950 dark:text-white"
        >
          Saints Community Church
        </p>
        <p class="m-0 truncate text-xs text-gray-500 dark:text-gray-400">
          Analytics and report portal
        </p>
      </div>
    </div>

    <nav class="flex-1 space-y-1 px-3 py-4" aria-label="Main navigation">
      <template v-for="item in menuItems" :key="item.to || item.label">
        <div v-if="item.children" class="space-y-1">
          <div
            class="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition"
            :class="
              isGroupActive(item)
                ? 'bg-[#a83632]/5 text-[#a83632] dark:bg-[#a83632]/10 dark:text-[#f2b3af]'
                : 'text-gray-600 dark:text-gray-300'
            "
          >
            <i :class="[item.icon, 'text-base']" />
            <span v-if="!collapsed" class="truncate">{{ item.label }}</span>
          </div>

          <div
            v-if="!collapsed"
            class="ml-5 space-y-1 border-l border-gray-200 pl-3 dark:border-gray-800"
          >
            <NuxtLink
              v-for="child in item.children"
              :key="child.to"
              :to="child.to"
              class="group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-gray-600 no-underline transition hover:bg-gray-50 hover:text-gray-950 dark:text-gray-300 dark:hover:bg-gray-900 dark:hover:text-white"
              active-class="!bg-[#a83632]/10 !text-[#a83632] dark:!bg-[#a83632]/20 dark:!text-[#f2b3af]"
            >
              <i :class="[child.icon, 'text-sm']" />
              <span class="truncate">{{ child.label }}</span>
            </NuxtLink>
          </div>
        </div>

        <NuxtLink
          v-else
          :to="item.to"
          class="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-600 no-underline transition hover:bg-gray-50 hover:text-gray-950 dark:text-gray-300 dark:hover:bg-gray-900 dark:hover:text-white"
          active-class="!bg-[#a83632]/10 !text-[#a83632] dark:!bg-[#a83632]/20 dark:!text-[#f2b3af]"
        >
          <i :class="[item.icon, 'text-base']" />
          <span v-if="!collapsed" class="truncate">{{ item.label }}</span>
        </NuxtLink>
      </template>
    </nav>
  </aside>
</template>
