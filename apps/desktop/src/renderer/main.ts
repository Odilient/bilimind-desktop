import { createApp } from 'vue';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/700.css';
import './styles/base.css';
import { SPRITE } from './sprite';
import { installMock } from './mock';
import App from './App.vue';

// No Electron preload (vite dev / preview / screenshots): install the browser mock with the showcase data.
if (!window.bilimind) installMock();

document.body.insertAdjacentHTML('afterbegin', SPRITE);
createApp(App).mount('#app');
