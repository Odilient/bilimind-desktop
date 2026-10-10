import { createApp } from 'vue';
import App from './App.vue';
import { COURSE_KEY, loadCourse } from './course.ts';
import { injectSprite } from './sprite.ts';
import { initProgress, listenForPassed } from './runtime/progress.ts';
import { applyPrefs } from './runtime/ui.ts';
import { startRouter } from './router.ts';
import { exposeApp } from './runtime/app.ts';
import './styles/fonts.css';
import './styles/tokens.css';
import './styles/shell.css';
import './styles/blocks.css';
import './styles/overlays.css';
import './styles/extra.css';
import './styles/app.css';

injectSprite();
startRouter();
listenForPassed();

loadCourse().then(({ course, errors }) => {
  const app = createApp(App, { errors });
  app.config.errorHandler = (err, _vm, info) => console.warn('[bilimind] render problem:', info, err);
  if (course) {
    app.provide(COURSE_KEY, course);
    initProgress(course.id);
    applyPrefs();
    document.title = `${course.title} · BiliMind`;
    if (course.language) document.documentElement.lang = course.language;
    document.documentElement.dataset.skin = course.skin;
    exposeApp(course);
  }
  app.mount('#app');
});
