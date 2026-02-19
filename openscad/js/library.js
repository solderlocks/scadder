// ── Library Grid (Landing Page) ───────────────────────────────────────────────

const app = {
    data: [],        // All models from JSON
    filtered: [],    // Models matching search

    // State
    page: 1,
    limit: 10,       // Items per page
    view: 'grid',    // 'grid' or 'list'
    search: '',

    async init() {
        // Only run on landing page
        if (urlParam('file')) return;

        const grid = document.getElementById('libraryGrid');
        if (!grid) return;

        try {
            const res = await fetch('library.json');
            this.data = await res.json();
            this.filtered = this.data;

            this.render();
        } catch (e) {
            grid.innerHTML = `<p style="color:var(--text-dim)">Error loading library: ${e.message}</p>`;
        }
    },

    handleSearch(query) {
        this.search = query.toLowerCase().trim();
        this.page = 1;

        if (!this.search) {
            this.filtered = this.data;
        } else {
            this.filtered = this.data.filter(item => {
                const text = `${item.title} ${item.description} ${item.author} ${item.tags.join(' ')}`.toLowerCase();
                return text.includes(this.search);
            });
        }
        this.render();
    },

    setView(mode) {
        this.view = mode;
        document.getElementById('libraryGrid').className = `library-grid ${mode === 'list' ? 'list-view' : ''}`;

        document.getElementById('btnGrid').classList.toggle('active', mode === 'grid');
        document.getElementById('btnList').classList.toggle('active', mode === 'list');
    },

    setPage(p) {
        if (p < 1 || p > Math.ceil(this.filtered.length / this.limit)) return;
        this.page = p;
        this.render();

        document.querySelector('.library-controls').scrollIntoView({ behavior: 'smooth' });
    },

    render() {
        const grid = document.getElementById('libraryGrid');
        const countEl = document.getElementById('resultCount');
        const paginateEl = document.getElementById('pagination');

        // Update Count
        countEl.textContent = `${this.filtered.length} Object${this.filtered.length !== 1 ? 's' : ''}`;

        // Calculate Pagination Slices
        const start = (this.page - 1) * this.limit;
        const end = start + this.limit;
        const pageItems = this.filtered.slice(start, end);

        if (pageItems.length === 0) {
            grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--text-dim)">No objects found matching "${this.search}"</div>`;
            paginateEl.innerHTML = '';
            return;
        }

        // Render Cards
        grid.innerHTML = pageItems.map(item => {
            let href = `?file=${encodeURIComponent(item.url)}`;
            if (item.vars && Object.keys(item.vars).length > 0) {
                href += `&vars=${encodeURIComponent(JSON.stringify(item.vars))}`;
            }
            return `
      <a href="${href}" class="lib-card">
        <img src="assets/previews/${item.id || 'placeholder'}.png" class="lib-img" loading="lazy" alt="${item.title}">
        <div class="lib-meta">
          <div>
            <div class="lib-title">${item.title}</div>
            <div class="lib-desc">${item.description}</div>
          </div>
          ${this.view === 'list' ?
                    `<div style="font-family:var(--mono);font-size:0.7rem;color:var(--amber);white-space:nowrap;margin-left:1rem">by ${item.author}</div>`
                    :
                    `<div style="margin-top:0.5rem;font-size:0.65rem;color:var(--text-dim);font-family:var(--mono)">by ${item.author}</div>`
                }
        </div>
      </a>
    `}).join('');

        // Render Pagination Controls
        const totalPages = Math.ceil(this.filtered.length / this.limit);
        if (totalPages > 1) {
            let btns = '';

            // Prev Button
            btns += `<button class="page-btn" onclick="app.setPage(${this.page - 1})" ${this.page === 1 ? 'disabled' : ''}>←</button>`;

            // Numbered Buttons
            for (let i = 1; i <= totalPages; i++) {
                if (i === 1 || i === totalPages || (i >= this.page - 1 && i <= this.page + 1)) {
                    btns += `<button class="page-btn ${i === this.page ? 'active' : ''}" onclick="app.setPage(${i})">${i}</button>`;
                } else if (i === this.page - 2 || i === this.page + 2) {
                    btns += `<span style="color:var(--text-dim);align-self:end">...</span>`;
                }
            }

            // Next Button
            btns += `<button class="page-btn" onclick="app.setPage(${this.page + 1})" ${this.page === totalPages ? 'disabled' : ''}>→</button>`;

            paginateEl.innerHTML = btns;
        } else {
            paginateEl.innerHTML = '';
        }
    }
};
