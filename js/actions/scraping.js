/**
 * DOCE.AI - Ações de Web Scraping
 * Busca informações em sites específicos
 *
 * NOTA: Scraping direto do navegador pode ser bloqueado por CORS.
 * Para produção, usar um backend/proxy ou serviço como:
 * - Vercel Edge Functions
 * - Cloudflare Workers
 * - AllOrigins proxy
 */

// Proxy CORS para desenvolvimento
const CORS_PROXY = 'https://api.allorigins.win/get?url=';

// Sites configurados
const SITES = {
    saintyco: {
        name: 'Saintyco',
        baseUrl: 'https://www.saintyco.com/pt/',
        searchUrl: 'https://www.saintyco.com/pt/?s=',
        selectors: {
            produtos: '.product-item, .product-card',
            nome: '.product-title, h2',
            preco: '.price',
            imagem: 'img',
            link: 'a',
            descricao: '.product-description, .excerpt'
        }
    },
    countec: {
        name: 'Countec Group',
        baseUrl: 'https://countec-group.com/en/sub/sub02_01.php',
        searchUrl: 'https://countec-group.com/en/sub/sub02_01.php?search=',
        selectors: {
            produtos: '.product-list-item, .product',
            nome: '.product-name, h3',
            imagem: 'img',
            link: 'a',
            specs: '.specifications, .spec-table'
        }
    }
};

export const scrapingActions = {
    /**
     * Buscar produtos no Saintyco
     */
    async buscarSaintyco(params) {
        const { termo, categoria } = params;
        return await this.buscarSite('saintyco', termo, categoria);
    },

    /**
     * Buscar produtos no Countec
     */
    async buscarCountec(params) {
        const { termo, categoria } = params;
        return await this.buscarSite('countec', termo, categoria);
    },

    /**
     * Buscar em site genérico
     */
    async buscarSite(siteId, termo, categoria) {
        const site = SITES[siteId];

        if (!site) {
            return {
                success: false,
                error: `Site "${siteId}" não configurado`
            };
        }

        try {
            // Montar URL de busca
            const searchUrl = `${site.searchUrl}${encodeURIComponent(termo)}`;

            // Tentar buscar via proxy CORS
            const response = await fetch(`${CORS_PROXY}${encodeURIComponent(searchUrl)}`);
            const data = await response.json();

            if (!data.contents) {
                throw new Error('Não foi possível acessar o site');
            }

            // Parsear HTML
            const parser = new DOMParser();
            const doc = parser.parseFromString(data.contents, 'text/html');

            // Extrair produtos
            const produtos = this.extrairProdutos(doc, site.selectors, site.baseUrl);

            if (produtos.length === 0) {
                return {
                    success: true,
                    encontrados: 0,
                    message: `Nenhum produto encontrado para "${termo}" no ${site.name}`,
                    sugestao: 'Tente outros termos de busca'
                };
            }

            return {
                success: true,
                site: site.name,
                termo,
                encontrados: produtos.length,
                produtos
            };
        } catch (error) {
            console.error(`[SCRAPING] Erro ao buscar ${siteId}:`, error);

            // Fallback - retornar link para busca manual
            return {
                success: false,
                error: 'Não consegui acessar o site automaticamente',
                alternativa: {
                    message: `Você pode buscar manualmente em:`,
                    url: `${site.searchUrl}${encodeURIComponent(termo)}`,
                    action: 'open_link'
                }
            };
        }
    },

    /**
     * Extrair produtos do HTML
     */
    extrairProdutos(doc, selectors, baseUrl) {
        const produtos = [];
        const elementos = doc.querySelectorAll(selectors.produtos);

        elementos.forEach((el, index) => {
            if (index >= 10) return; // Limitar a 10 resultados

            const produto = {
                nome: this.getTextContent(el, selectors.nome),
                preco: this.getTextContent(el, selectors.preco),
                descricao: this.getTextContent(el, selectors.descricao),
                imagem: this.getImgSrc(el, selectors.imagem, baseUrl),
                link: this.getHref(el, selectors.link, baseUrl)
            };

            if (produto.nome) {
                produtos.push(produto);
            }
        });

        return produtos;
    },

    /**
     * Helpers para extração
     */
    getTextContent(parent, selector) {
        const el = parent.querySelector(selector);
        return el ? el.textContent.trim() : null;
    },

    getImgSrc(parent, selector, baseUrl) {
        const img = parent.querySelector(selector);
        if (!img) return null;

        let src = img.getAttribute('src') || img.getAttribute('data-src');
        if (src && !src.startsWith('http')) {
            src = new URL(src, baseUrl).href;
        }
        return src;
    },

    getHref(parent, selector, baseUrl) {
        const link = parent.querySelector(selector);
        if (!link) return null;

        let href = link.getAttribute('href');
        if (href && !href.startsWith('http')) {
            href = new URL(href, baseUrl).href;
        }
        return href;
    },

    /**
     * Baixar arquivo (PDF, doc, etc) de um site
     */
    async baixarArquivo(params) {
        const { url, tipo } = params;

        try {
            // Verificar se é um link direto para arquivo
            const isArquivo = /\.(pdf|doc|docx|xls|xlsx|zip)$/i.test(url);

            if (isArquivo) {
                // Retornar link para download
                return {
                    success: true,
                    message: 'Arquivo encontrado!',
                    tipo: url.split('.').pop().toUpperCase(),
                    action: 'download',
                    url
                };
            }

            // Tentar encontrar links de arquivo na página
            const response = await fetch(`${CORS_PROXY}${encodeURIComponent(url)}`);
            const data = await response.json();

            const parser = new DOMParser();
            const doc = parser.parseFromString(data.contents, 'text/html');

            // Buscar links de arquivos
            const arquivos = [];
            doc.querySelectorAll('a[href]').forEach(link => {
                const href = link.getAttribute('href');
                if (/\.(pdf|doc|docx|xls|xlsx)$/i.test(href)) {
                    arquivos.push({
                        nome: link.textContent.trim() || 'Arquivo',
                        tipo: href.split('.').pop().toUpperCase(),
                        url: href.startsWith('http') ? href : new URL(href, url).href
                    });
                }
            });

            if (arquivos.length === 0) {
                return {
                    success: false,
                    message: 'Nenhum arquivo encontrado nesta página'
                };
            }

            return {
                success: true,
                encontrados: arquivos.length,
                arquivos
            };
        } catch (error) {
            console.error('[SCRAPING] Erro ao baixar:', error);
            return {
                success: false,
                error: error.message,
                alternativa: {
                    message: 'Abrir página manualmente:',
                    url,
                    action: 'open_link'
                }
            };
        }
    },

    /**
     * Adicionar novo site para scraping
     */
    adicionarSite(params) {
        const { id, name, baseUrl, searchUrl, selectors } = params;

        SITES[id] = {
            name,
            baseUrl,
            searchUrl,
            selectors: selectors || {
                produtos: '.product',
                nome: 'h2, h3, .title',
                imagem: 'img',
                link: 'a'
            }
        };

        return {
            success: true,
            message: `Site "${name}" adicionado!`,
            sites: Object.keys(SITES)
        };
    },

    /**
     * Listar sites disponíveis
     */
    listarSites() {
        return Object.entries(SITES).map(([id, site]) => ({
            id,
            name: site.name,
            url: site.baseUrl
        }));
    },

    /**
     * Buscar em todos os sites
     */
    async buscarTodos(params) {
        const { termo } = params;
        const resultados = {};

        for (const siteId of Object.keys(SITES)) {
            resultados[siteId] = await this.buscarSite(siteId, termo);
        }

        const totalEncontrados = Object.values(resultados)
            .reduce((acc, r) => acc + (r.encontrados || 0), 0);

        return {
            termo,
            totalEncontrados,
            resultados
        };
    }
};
