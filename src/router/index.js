import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('@/views/home.vue'),
  },
  {
    path: '/server/:id',
    name: 'ServerDetail',
    component: () => import('@/views/detail.vue'),
  },
  {
    path: '/view-password',
    name: 'ViewPassword',
    component: () => import('@/views/view-password.vue'),
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

export default router;
