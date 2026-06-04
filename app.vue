<script setup>
const route = useRoute()

const usesAdminShell = computed(() => {
  return route.path !== '/login'
})
</script>

<template>
  <NuxtLayout v-if="usesAdminShell" name="admin">
    <NuxtPage />
  </NuxtLayout>
  <NuxtPage v-else />
</template>
