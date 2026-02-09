/**
 * DOCE.AI - Integração com Jace.AI
 * Hub de emails via Jace.AI
 *
 * NOTA: Jace.AI só tem interface web, então temos algumas opções:
 * 1. Instruções para o usuário consultar manualmente
 * 2. Automação via extensão do navegador (futuro)
 * 3. Se Jace.AI tiver API oculta, podemos explorar
 */

// Configuração do Jace.AI
const JACE_URL = 'https://jace.ai'; // URL do Jace.AI

// Cache local de consultas (para não repetir)
const cacheConsultas = new Map();

export const jaceActions = {
    /**
     * Consultar emails via Jace.AI
     * Por enquanto, retorna instruções para o usuário
     */
    async consultarEmails(params) {
        const { termo, remetente, data, assunto } = params;

        // Montar query de busca
        const query = this.montarQuery({ termo, remetente, data, assunto });

        // Verificar cache
        const cacheKey = JSON.stringify(params);
        if (cacheConsultas.has(cacheKey)) {
            const cached = cacheConsultas.get(cacheKey);
            if (Date.now() - cached.timestamp < 5 * 60 * 1000) { // 5 min
                return {
                    ...cached.data,
                    fromCache: true
                };
            }
        }

        // Por enquanto, retorna instruções
        return {
            success: true,
            modo: 'manual',
            message: `Para buscar emails sobre "${termo || assunto || 'sua consulta'}":`,
            instrucoes: [
                `1. Abra o Jace.AI: ${JACE_URL}`,
                `2. Pergunte: "${query}"`,
                `3. Copie a resposta e cole aqui`
            ],
            query,
            action: 'jace_query',
            buttons: [
                {
                    label: 'Abrir Jace.AI',
                    action: 'open_link',
                    url: JACE_URL
                },
                {
                    label: 'Copiar pergunta',
                    action: 'copy',
                    text: query
                }
            ]
        };
    },

    /**
     * Resumir email específico
     */
    async resumirEmail(params) {
        const { assunto, remetente } = params;

        const query = `Resuma o email ${remetente ? `de ${remetente}` : ''} ${assunto ? `sobre "${assunto}"` : ''}`;

        return {
            success: true,
            modo: 'manual',
            message: 'Para resumir este email:',
            instrucoes: [
                `1. Abra o Jace.AI: ${JACE_URL}`,
                `2. Pergunte: "${query}"`,
                `3. Cole o resumo aqui`
            ],
            query,
            action: 'jace_query'
        };
    },

    /**
     * Montar query para Jace.AI
     */
    montarQuery(params) {
        const { termo, remetente, data, assunto } = params;
        let query = 'Encontre emails';

        if (remetente) query += ` de ${remetente}`;
        if (assunto) query += ` sobre "${assunto}"`;
        if (termo) query += ` que mencionam "${termo}"`;
        if (data) query += ` de ${data}`;

        return query;
    },

    /**
     * Registrar resposta do Jace.AI (usuário cola manualmente)
     */
    async registrarResposta(params) {
        const { consulta, resposta } = params;

        // Salvar no cache
        cacheConsultas.set(JSON.stringify(consulta), {
            data: { resposta },
            timestamp: Date.now()
        });

        // Processar resposta (extrair informações úteis)
        const info = this.processarRespostaJace(resposta);

        return {
            success: true,
            message: 'Resposta registrada!',
            info
        };
    },

    /**
     * Processar texto de resposta do Jace.AI
     */
    processarRespostaJace(texto) {
        // Tentar extrair informações estruturadas
        const info = {
            emails: [],
            resumo: texto,
            datas: [],
            remetentes: []
        };

        // Extrair padrões de email
        const emailRegex = /[\w.-]+@[\w.-]+\.\w+/g;
        const emails = texto.match(emailRegex);
        if (emails) info.remetentes = [...new Set(emails)];

        // Extrair datas
        const dataRegex = /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/g;
        const datas = texto.match(dataRegex);
        if (datas) info.datas = [...new Set(datas)];

        return info;
    },

    /**
     * Verificar se Jace.AI está acessível
     */
    async verificarStatus() {
        try {
            const response = await fetch(JACE_URL, { mode: 'no-cors' });
            return {
                online: true,
                url: JACE_URL
            };
        } catch (error) {
            return {
                online: false,
                error: 'Não foi possível verificar Jace.AI'
            };
        }
    },

    /**
     * Gerar link para consulta específica no Jace
     * (Se descobrirmos que Jace aceita parâmetros na URL)
     */
    gerarLinkConsulta(query) {
        // Por enquanto, só retorna a URL base
        // Se Jace.AI aceitar ?q=..., podemos usar
        return JACE_URL;
    },

    /**
     * Ações rápidas comuns
     */
    acoesRapidas: {
        ultimosEmails: () => jaceActions.consultarEmails({
            termo: 'últimos emails de hoje'
        }),

        emailsNaoLidos: () => jaceActions.consultarEmails({
            termo: 'emails não lidos'
        }),

        emailsImportantes: () => jaceActions.consultarEmails({
            termo: 'emails importantes ou urgentes'
        }),

        resumoDia: () => ({
            success: true,
            query: 'Faça um resumo dos emails que recebi hoje',
            action: 'jace_query',
            message: 'Pergunte ao Jace.AI: "Faça um resumo dos emails que recebi hoje"'
        })
    }
};

/**
 * Instruções para integração futura:
 *
 * OPÇÃO 1: Browser Extension
 * - Criar extensão que injeta script no Jace.AI
 * - Comunicar via postMessage com a Doce.AI
 *
 * OPÇÃO 2: Puppeteer/Playwright (Backend)
 * - Criar API no Vercel que usa automação
 * - Requer autenticação persistente
 *
 * OPÇÃO 3: API Oficial (se existir)
 * - Verificar se Jace.AI tem API ou webhooks
 * - Integrar diretamente
 */
