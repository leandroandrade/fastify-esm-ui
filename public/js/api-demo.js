// Page script for the home page (passed as `scripts: ['api-demo.js']` by the view). Loaded
// with `defer` before alpine.min.js, so the component is registered before Alpine starts.
document.addEventListener('alpine:init', () => {
  Alpine.data('apiDemo', () => ({
    ...Alpine.notificadores(),

    loading: false,
    response: null,
    name: '',

    async fetchHello() {
      this.loading = true;
      this.response = null;

      try {
        const url = this.name
          ? `/api/hello?name=${encodeURIComponent(this.name)}`
          : '/api/hello';

        const res = await fetch(url);
        const data = await res.json();

        if (!res.ok) {
          this.notificarErro(data.message || 'Erro ao buscar dados do servidor');
          return;
        }

        this.response = data;

        this.notificarSucesso(data.message);
      } catch (error) {
        this.notificarErro('Erro ao buscar dados do servidor');
        console.error('Erro na requisição:', error);
      } finally {
        this.loading = false;
      }
    },

    clearResponse() {
      this.response = null;
      this.name = '';
    },

    // JSON is a global the CSP build of Alpine cannot reach from a template expression.
    get formattedResponse() {
      return JSON.stringify(this.response, null, 2);
    },

    get buttonLabel() {
      return this.loading ? 'Enviando...' : 'Enviar Requisição';
    }
  }));
});
