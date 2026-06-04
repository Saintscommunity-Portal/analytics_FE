<script setup>
import { reactive } from 'vue'

definePageMeta({
  middleware: 'guest',
})

const auth = useAuth()
const form = reactive({
  email: '',
  password: '',
})

async function handleSubmit() {
  await auth.login({
    email: form.email,
    password: form.password,
  })

  await navigateTo('/dashboard')
}
</script>

<template>
  <main class="min-h-screen bg-gray-50 px-4 py-10 text-gray-900">
    <section class="mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[1fr_440px]">
      <div class="hidden lg:block">
        <p class="mb-3 text-sm font-semibold uppercase tracking-[0.24em] text-[#a83632]">
          SCC Analytics
        </p>
        <h1 class="max-w-xl text-5xl font-semibold leading-tight tracking-tight text-gray-950">
          Focused reporting for admin decisions.
        </h1>
        <p class="mt-5 max-w-lg text-base leading-7 text-gray-500">
          Sign in to access the analytics portal, worker records, and operational reporting tools.
        </p>
      </div>

      <Card class="border border-gray-200 shadow-sm">
        <template #content>
          <div class="mb-7">
            <p class="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#a83632]">
              Admin login
            </p>
            <h2 class="m-0 text-2xl font-semibold tracking-tight text-gray-950">
              Welcome back
            </h2>
            <p class="mt-2 text-sm text-gray-500">
              Use your admin credentials to continue.
            </p>
          </div>

          <form class="grid gap-5" @submit.prevent="handleSubmit">
            <Message v-if="auth.error.value" severity="error" :closable="false">
              {{ auth.error.value }}
            </Message>

            <div class="grid gap-2">
              <label class="text-sm font-medium text-gray-700" for="email">Email address</label>
              <InputText
                id="email"
                v-model="form.email"
                autocomplete="email"
                inputmode="email"
                placeholder="admin@example.com"
                required
                type="email"
                fluid
              />
            </div>

            <div class="grid gap-2">
              <label class="text-sm font-medium text-gray-700" for="password">Password</label>
              <Password
                id="password"
                v-model="form.password"
                autocomplete="current-password"
                placeholder="Enter your password"
                required
                :feedback="false"
                toggle-mask
                fluid
              />
            </div>

            <Button
              class="border-[#a83632] bg-[#a83632] hover:border-[#922f2c] hover:bg-[#922f2c]"
              label="Sign in"
              type="submit"
              :loading="auth.loading.value"
              fluid
            />
          </form>
        </template>
      </Card>
    </section>
  </main>
</template>
