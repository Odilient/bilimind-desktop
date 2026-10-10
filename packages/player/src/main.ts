import { createApp } from 'vue';
import App from './App.vue';
import { COURSE_KEY, loadCourse } from './course.ts';

loadCourse().then(({ course, errors }) => {
  const app = createApp(App, { errors });
  if (course) app.provide(COURSE_KEY, course);
  app.mount('#app');
});
