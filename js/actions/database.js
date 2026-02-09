/**
 * DOCE.AI - Ações de Banco de Dados Local
 * Gerencia orçamentos, specs e dados locais em JSON
 */

// Caminho do banco de dados local
const DB_KEY = 'doce_database';

// Estrutura inicial do banco
function getInitialDB() {
    return {
        orcamentos: [],
        produtos: [],
        specs: [],
        historico: [],
        sites_scraping: [
            { id: 'saintyco', url: 'https://www.saintyco.com/pt/', ativo: true },
            { id: 'countec', url: 'https://countec-group.com/en/sub/sub02_01.php', ativo: true }
        ],
        config: {
            criado_em: new Date().toISOString(),
            versao: '1.0.0'
        }
    };
}

// Carregar banco de dados
function loadDB() {
    try {
        const data = localStorage.getItem(DB_KEY);
        if (data) {
            return JSON.parse(data);
        }
        return getInitialDB();
    } catch (error) {
        console.error('[DB] Erro ao carregar:', error);
        return getInitialDB();
    }
}

// Salvar banco de dados
function saveDB(db) {
    try {
        localStorage.setItem(DB_KEY, JSON.stringify(db));
        return true;
    } catch (error) {
        console.error('[DB] Erro ao salvar:', error);
        return false;
    }
}

// Gerar ID único
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export const databaseActions = {
    // === ORÇAMENTOS ===

    /**
     * Salvar novo orçamento
     */
    async salvarOrcamento(params) {
        const { cliente, itens, valor_total, imagens, specs, origem } = params;

        const db = loadDB();
        const novoOrcamento = {
            id: generateId(),
            cliente,
            itens: itens || [],
            valor_total: valor_total || 0,
            imagens: imagens || [],
            specs: specs || [],
            origem: origem || 'manual',
            criado_em: new Date().toISOString(),
            atualizado_em: new Date().toISOString()
        };

        db.orcamentos.push(novoOrcamento);
        saveDB(db);

        return {
            message: `Orçamento salvo com sucesso!`,
            orcamento: novoOrcamento
        };
    },

    /**
     * Buscar orçamento por termo
     */
    async buscarOrcamento(params) {
        const { termo, cliente, data } = params;
        const db = loadDB();

        let resultados = db.orcamentos;

        // Filtrar por termo (busca em cliente e itens)
        if (termo) {
            const termoLower = termo.toLowerCase();
            resultados = resultados.filter(orc =>
                orc.cliente?.toLowerCase().includes(termoLower) ||
                orc.itens?.some(item => item.nome?.toLowerCase().includes(termoLower))
            );
        }

        // Filtrar por cliente
        if (cliente) {
            resultados = resultados.filter(orc =>
                orc.cliente?.toLowerCase().includes(cliente.toLowerCase())
            );
        }

        // Filtrar por data
        if (data) {
            resultados = resultados.filter(orc =>
                orc.criado_em?.startsWith(data)
            );
        }

        return {
            encontrados: resultados.length,
            orcamentos: resultados
        };
    },

    /**
     * Listar todos os orçamentos
     */
    async listarOrcamentos(params) {
        const { limite = 10, ordem = 'recente' } = params || {};
        const db = loadDB();

        let orcamentos = [...db.orcamentos];

        // Ordenar
        if (ordem === 'recente') {
            orcamentos.sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em));
        } else if (ordem === 'valor') {
            orcamentos.sort((a, b) => b.valor_total - a.valor_total);
        }

        // Limitar
        orcamentos = orcamentos.slice(0, limite);

        return {
            total: db.orcamentos.length,
            mostrando: orcamentos.length,
            orcamentos
        };
    },

    // === PRODUTOS E SPECS ===

    /**
     * Salvar produto com especificações
     */
    async salvarProduto(params) {
        const { nome, fabricante, specs, preco, imagem, categoria } = params;

        const db = loadDB();
        const novoProduto = {
            id: generateId(),
            nome,
            fabricante,
            specs: specs || {},
            preco: preco || null,
            imagem: imagem || null,
            categoria: categoria || 'geral',
            criado_em: new Date().toISOString()
        };

        db.produtos.push(novoProduto);
        saveDB(db);

        return {
            message: `Produto "${nome}" salvo!`,
            produto: novoProduto
        };
    },

    /**
     * Buscar especificações de produto
     */
    async buscarSpecs(params) {
        const { produto, fabricante } = params;
        const db = loadDB();

        const termoLower = produto?.toLowerCase() || '';

        const resultados = db.produtos.filter(p => {
            const matchNome = p.nome?.toLowerCase().includes(termoLower);
            const matchFab = !fabricante || p.fabricante?.toLowerCase().includes(fabricante.toLowerCase());
            return matchNome && matchFab;
        });

        if (resultados.length === 0) {
            return {
                encontrado: false,
                message: `Nenhum produto encontrado para "${produto}"`,
                sugestao: 'Posso buscar nos sites Saintyco ou Countec?'
            };
        }

        return {
            encontrado: true,
            produtos: resultados
        };
    },

    // === SITES DE SCRAPING ===

    /**
     * Adicionar novo site para scraping
     */
    async adicionarSite(params) {
        const { nome, url, seletores } = params;

        const db = loadDB();
        const novoSite = {
            id: nome.toLowerCase().replace(/\s/g, '_'),
            nome,
            url,
            seletores: seletores || {},
            ativo: true,
            adicionado_em: new Date().toISOString()
        };

        db.sites_scraping.push(novoSite);
        saveDB(db);

        return {
            message: `Site "${nome}" adicionado para busca!`,
            site: novoSite
        };
    },

    /**
     * Listar sites configurados
     */
    async listarSites() {
        const db = loadDB();
        return {
            sites: db.sites_scraping
        };
    },

    // === HISTÓRICO ===

    /**
     * Registrar ação no histórico
     */
    async registrarHistorico(params) {
        const { acao, dados, resultado } = params;

        const db = loadDB();
        db.historico.push({
            id: generateId(),
            acao,
            dados,
            resultado,
            timestamp: new Date().toISOString()
        });

        // Manter apenas últimos 100 registros
        if (db.historico.length > 100) {
            db.historico = db.historico.slice(-100);
        }

        saveDB(db);
        return { registrado: true };
    },

    // === UTILITÁRIOS ===

    /**
     * Exportar banco de dados
     */
    async exportarDB() {
        const db = loadDB();
        return {
            dados: db,
            exportado_em: new Date().toISOString()
        };
    },

    /**
     * Importar banco de dados
     */
    async importarDB(params) {
        const { dados } = params;

        if (!dados || !dados.orcamentos) {
            return { success: false, error: 'Dados inválidos' };
        }

        saveDB(dados);
        return {
            success: true,
            message: 'Banco de dados importado com sucesso!'
        };
    },

    /**
     * Limpar banco de dados
     */
    async limparDB() {
        saveDB(getInitialDB());
        return {
            success: true,
            message: 'Banco de dados reiniciado'
        };
    }
};
