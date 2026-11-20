// The pages run the CSP build of Alpine (@alpinejs/csp): template expressions go through
// Alpine's own parser, which has no arrow functions, template literals, `new`, `typeof` or
// globals such as setTimeout, Math, Date or JSON. Anything beyond property access, method
// calls, operators and ternaries belongs in an Alpine.data component or getter like the
// ones below.
document.addEventListener('alpine:init', () => {
  // theme-init.js sets data-theme before paint; this store mirrors it reactively (so the
  // sun/moon icon binds), persists an explicit choice, and — until the user makes one —
  // keeps following the OS preference live.
  Alpine.store('theme', {
    isDark: document.documentElement.dataset.theme === 'dark',

    init() {
      if (typeof matchMedia !== 'function') {
        return;
      }

      const media = matchMedia('(prefers-color-scheme: dark)');
      const onSystemChange = () => {
        if (this.isExplicitChoice()) {
          return;
        }

        this.apply(media.matches ? 'dark' : 'light');
      };
      media.addEventListener('change', onSystemChange);
    },

    isExplicitChoice() {
      try {
        const stored = localStorage.getItem('theme');

        return stored === 'dark' || stored === 'light';
      } catch (error) {
        return false;
      }
    },

    apply(theme) {
      this.isDark = theme === 'dark';
      document.documentElement.dataset.theme = theme;
    },

    toggle() {
      const next = this.isDark ? 'light' : 'dark';
      this.apply(next);
      try {
        localStorage.setItem('theme', next);
      } catch (error) {
        // Persisting is best-effort; a blocked localStorage still toggles for this session.
      }
    },

    get label() {
      return this.isDark ? 'Mudar para o tema claro' : 'Mudar para o tema escuro';
    }
  });

  Alpine.store('formatters', {
    formatarDataRelativa(isoString, agora = Date.now()) {
      const diff = agora - new Date(isoString).getTime();
      const min = Math.floor(diff / 60000);

      if (min < 1) return 'agora mesmo';
      if (min === 1) return 'há 1 min';
      if (min < 60) return `há ${min} min`;

      const h = Math.floor(min / 60);
      if (h === 1) return 'há 1 hora';
      if (h < 24) return `há ${h} horas`;

      const d = Math.floor(h / 24);
      return d === 1 ? 'há 1 dia' : `há ${d} dias`;
    }
  });

  Alpine.notificadores = () => ({
    notificarSucesso(mensagem, duracao = 5000) {
      this.$dispatch('show-notification', { message: mensagem, type: 'success', duration: duracao });
    },
    notificarErro(mensagem, duracao = 7000) {
      this.$dispatch('show-notification', { message: mensagem, type: 'danger', duration: duracao });
    },
    notificarAviso(mensagem, duracao = 6000) {
      this.$dispatch('show-notification', { message: mensagem, type: 'warning', duration: duracao });
    },
    notificarInfo(mensagem, duracao = 6000) {
      this.$dispatch('show-notification', { message: mensagem, type: 'info', duration: duracao });
    }
  });

  Alpine.data('main', () => ({
    ...Alpine.notificadores()
  }));

  Alpine.data('notifications', () => ({
    notifications: [],

    add(event) {
      const { detail } = event;

      this.notifications.push({
        id: event.timeStamp,
        type: detail.type || 'success',
        content: detail.message,
        duration: typeof detail.duration === 'number' ? detail.duration : 5000
      });
    },

    remove(notification) {
      function isOther(item) {
        return item.id !== notification.id;
      }

      this.notifications = this.notifications.filter(isOther);
    },

    get hasNotifications() {
      return this.notifications.length > 0;
    }
  }));

  // One toast inside the x-for of the stack: `this.notification` comes from the loop and
  // `this.remove` from the parent component.
  Alpine.data('notification', () => ({
    show: false,

    init() {
      const reveal = () => {
        this.show = true;
      };
      this.$nextTick(reveal);

      if (this.notification.duration > 0) {
        const dismiss = () => {
          this.transitionOut();
        };
        setTimeout(dismiss, this.notification.duration);
      }
    },

    transitionOut() {
      this.show = false;

      const removeAfterTransition = () => {
        this.remove(this.notification);
      };
      setTimeout(removeAfterTransition, 500);
    },

    get title() {
      return this.notification.type === 'danger' ? 'Error' : this.notification.type;
    }
  }));

  // A message rendered by the server (e.g. `errorMsg` passed to a view) shown through the
  // same toast stack. The text travels in a data attribute, escaped by EJS, and is only
  // ever written with x-text — never as HTML.
  Alpine.data('flashMessage', () => ({
    init() {
      const { message, type } = this.$el.dataset;
      if (!message) {
        return;
      }

      this.$dispatch('show-notification', { message, type: type || 'danger', duration: 7000 });
    }
  }));
});
