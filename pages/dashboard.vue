<script setup>
definePageMeta({
  middleware: 'auth',
  layout: 'admin',
})

const stats = [
  {
    label: 'Workers',
    value: 'Placeholder',
    detail: 'Worker menu is ready for the next feature.',
    icon: 'pi pi-users',
  },
  {
    label: 'Reports',
    value: 'Coming soon',
    detail: 'Reporting summaries will appear here.',
    icon: 'pi pi-file',
  },
  {
    label: 'System',
    value: 'Active',
    detail: 'Admin session is authenticated.',
    icon: 'pi pi-shield',
  },
]
</script>

<template>
  <section class="space-y-6">
    <div class="flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div>
        <p class="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#a83632]">
          Overview
        </p>
        <h1 class="m-0 text-3xl font-semibold tracking-tight text-gray-950">
          Dashboard
        </h1>
        <p class="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
          A clean placeholder dashboard shell for analytics resources and future reporting widgets.
        </p>
      </div>
    </div>

    <div class="grid gap-4 md:grid-cols-3">
      <Card v-for="stat in stats" :key="stat.label" class="border border-gray-200 shadow-sm">
        <template #content>
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="m-0 text-sm font-medium text-gray-500">{{ stat.label }}</p>
              <h2 class="mb-2 mt-3 text-xl font-semibold text-gray-950">{{ stat.value }}</h2>
              <p class="m-0 text-sm leading-6 text-gray-500">{{ stat.detail }}</p>
            </div>
            <span class="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#a83632]/10 text-[#a83632]">
              <i :class="stat.icon" />
            </span>
          </div>
        </template>
      </Card>
    </div>

    <Card class="border border-gray-200 shadow-sm">
      <template #content>
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 class="m-0 text-lg font-semibold text-gray-950">Workers</h2>
            <p class="mt-1 text-sm text-gray-500">
              Placeholder menu item is available in the sidebar.
            </p>
          </div>
          <Button
            label="Open workers"
            icon="pi pi-arrow-right"
            icon-pos="right"
            class="border-[#a83632] bg-[#a83632] hover:border-[#922f2c] hover:bg-[#922f2c]"
            @click="navigateTo('/workers')"
          />
        </div>
      </template>
    </Card>
  </section>
</template>
