/**
 * DOCE.AI - Ações de Planilhas
 * Integração com Google Sheets via API
 */

// Configuração do Google Sheets
// Você precisa configurar um projeto no Google Cloud Console
// e obter as credenciais OAuth2 ou usar uma Service Account
const GOOGLE_API_KEY = ''; // Sua API Key
const GOOGLE_CLIENT_ID = ''; // Seu Client ID

// Estado de autenticação
let googleAuth = null;
let isAuthenticated = false;

export const planilhaActions = {
    /**
     * Inicializar autenticação Google
     */
    async init() {
        // Carregar a API do Google
        return new Promise((resolve, reject) => {
            if (typeof gapi === 'undefined') {
                // Carregar script do Google
                const script = document.createElement('script');
                script.src = 'https://apis.google.com/js/api.js';
                script.onload = () => {
                    gapi.load('client:auth2', async () => {
                        try {
                            await gapi.client.init({
                                apiKey: GOOGLE_API_KEY,
                                clientId: GOOGLE_CLIENT_ID,
                                discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4'],
                                scope: 'https://www.googleapis.com/auth/spreadsheets'
                            });

                            googleAuth = gapi.auth2.getAuthInstance();
                            isAuthenticated = googleAuth.isSignedIn.get();
                            resolve(true);
                        } catch (error) {
                            reject(error);
                        }
                    });
                };
                document.head.appendChild(script);
            } else {
                resolve(true);
            }
        });
    },

    /**
     * Fazer login no Google
     */
    async login() {
        if (!googleAuth) {
            await this.init();
        }

        if (!isAuthenticated) {
            await googleAuth.signIn();
            isAuthenticated = true;
        }

        return { authenticated: true };
    },

    /**
     * Criar nova planilha
     */
    async criar(params) {
        const { nome, dados, abas = ['Dados'] } = params;

        // Verificar autenticação
        if (!isAuthenticated) {
            return {
                success: false,
                needsAuth: true,
                message: 'Preciso de permissão para acessar o Google Sheets.',
                action: 'google_login'
            };
        }

        try {
            // Criar planilha
            const response = await gapi.client.sheets.spreadsheets.create({
                properties: {
                    title: nome || `Doce AI - ${new Date().toLocaleDateString('pt-BR')}`
                },
                sheets: abas.map(aba => ({
                    properties: { title: aba }
                }))
            });

            const spreadsheetId = response.result.spreadsheetId;
            const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

            // Se tiver dados iniciais, inserir
            if (dados && dados.length > 0) {
                await this.inserirDados(spreadsheetId, 'A1', dados);
            }

            return {
                success: true,
                message: `Planilha "${nome}" criada!`,
                id: spreadsheetId,
                url: spreadsheetUrl,
                action: 'open_link'
            };
        } catch (error) {
            console.error('[PLANILHA] Erro ao criar:', error);
            return {
                success: false,
                error: error.message
            };
        }
    },

    /**
     * Ler dados de planilha
     */
    async ler(params) {
        const { planilha_id, range = 'A1:Z1000', aba = 'Sheet1' } = params;

        if (!isAuthenticated) {
            return {
                success: false,
                needsAuth: true,
                message: 'Preciso de permissão para ler a planilha.'
            };
        }

        try {
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: planilha_id,
                range: `${aba}!${range}`
            });

            const dados = response.result.values || [];

            return {
                success: true,
                linhas: dados.length,
                colunas: dados[0]?.length || 0,
                dados
            };
        } catch (error) {
            console.error('[PLANILHA] Erro ao ler:', error);
            return {
                success: false,
                error: error.message
            };
        }
    },

    /**
     * Atualizar planilha existente
     */
    async atualizar(params) {
        const { planilha_id, dados, range = 'A1', aba = 'Sheet1', modo = 'substituir' } = params;

        if (!isAuthenticated) {
            return {
                success: false,
                needsAuth: true,
                message: 'Preciso de permissão para atualizar a planilha.'
            };
        }

        try {
            const fullRange = `${aba}!${range}`;

            if (modo === 'adicionar') {
                // Adicionar no final
                await gapi.client.sheets.spreadsheets.values.append({
                    spreadsheetId: planilha_id,
                    range: fullRange,
                    valueInputOption: 'USER_ENTERED',
                    insertDataOption: 'INSERT_ROWS',
                    resource: { values: dados }
                });
            } else {
                // Substituir
                await gapi.client.sheets.spreadsheets.values.update({
                    spreadsheetId: planilha_id,
                    range: fullRange,
                    valueInputOption: 'USER_ENTERED',
                    resource: { values: dados }
                });
            }

            return {
                success: true,
                message: 'Planilha atualizada!',
                linhasAfetadas: dados.length
            };
        } catch (error) {
            console.error('[PLANILHA] Erro ao atualizar:', error);
            return {
                success: false,
                error: error.message
            };
        }
    },

    /**
     * Inserir dados em range específico
     */
    async inserirDados(spreadsheetId, range, dados) {
        await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId,
            range,
            valueInputOption: 'USER_ENTERED',
            resource: { values: dados }
        });
    },

    /**
     * Abrir planilha por link compartilhado
     * Extrai o ID do link e lê os dados
     */
    async abrirPorLink(params) {
        const { link } = params;

        // Extrair ID do link
        // Formatos suportados:
        // https://docs.google.com/spreadsheets/d/ID/edit
        // https://docs.google.com/spreadsheets/d/ID
        const match = link.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);

        if (!match) {
            return {
                success: false,
                error: 'Link de planilha inválido'
            };
        }

        const planilha_id = match[1];
        return await this.ler({ planilha_id });
    },

    /**
     * Criar planilha de orçamento
     */
    async criarOrcamento(params) {
        const { cliente, itens } = params;

        const dados = [
            ['ORÇAMENTO - DOCE AI'],
            [''],
            ['Cliente:', cliente],
            ['Data:', new Date().toLocaleDateString('pt-BR')],
            [''],
            ['Item', 'Quantidade', 'Preço Unit.', 'Total'],
            ...itens.map(item => [
                item.nome,
                item.quantidade,
                item.preco,
                `=B${itens.indexOf(item) + 7}*C${itens.indexOf(item) + 7}`
            ]),
            [''],
            ['', '', 'TOTAL:', `=SUM(D7:D${itens.length + 6})`]
        ];

        return await this.criar({
            nome: `Orçamento - ${cliente} - ${new Date().toLocaleDateString('pt-BR')}`,
            dados
        });
    }
};

// Verificar se precisa de configuração
export function needsGoogleConfig() {
    return !GOOGLE_API_KEY || !GOOGLE_CLIENT_ID;
}
