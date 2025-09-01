class KpiCard extends HTMLElement {
  connectedCallback() {
    if (this.hasAttribute('loading')) {
      this.innerHTML = `
        <div class="rounded-2xl border border-slate-200 p-5 shadow-lg animate-pulse bg-slate-200/60 h-24"></div>
      `;
      return;
    }
    const title = this.getAttribute('title') || '';
    const value = this.getAttribute('value') || '';
    const subtitle = this.getAttribute('subtitle') || '';
    const valueClass = this.getAttribute('value-class') || 'text-slate-900';
    this.innerHTML = `
      <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-200/50">
        <span class="text-slate-600 text-sm font-medium tracking-wide uppercase">${title}</span>
        <p class="mt-2 text-2xl md:text-3xl font-semibold ${valueClass}">${value}</p>
        ${subtitle ? `<p class="mt-1 text-xs text-slate-500">${subtitle}</p>` : ''}
      </div>
    `;
  }
}
customElements.define('kpi-card', KpiCard);
