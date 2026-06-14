import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import store from './store';

import './assets/scss/global.scss';
import 'remixicon/fonts/remixicon.css';
import 'font-logos/assets/font-logos.css';
import 'flag-icons/css/flag-icons.min.css';

store.dispatch('initTheme');

const app = createApp(App);

app.use(router);
app.use(store);

app.mount('#app');
