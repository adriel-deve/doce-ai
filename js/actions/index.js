/**
 * DOCE.AI - Sistema de Ações
 * Gerencia todas as ações disponíveis para os agentes
 */

// Importar todas as ações
import { orcamentoActions } from './orcamentos.js';
import { planilhaActions } from './planilhas.js';
import { scrapingActions } from './scraping.js';
import { databaseActions } from './database.js';
import { jaceActions } from './jace.js';

// Registro de todas as ações disponíveis
export const actionsRegistry = {
    // === ORÇAMENTOS ===
    'gerar_orcamento': {
        handler: orcamentoActions.gerar,
        description: 'Gera um novo orçamento no Local Orçamentos',
        params: ['cliente', 'itens', 'imagens'],
        category: 'trabalho',
        difficulty: 'facil'
    },
    'buscar_orcamento': {
        handler: databaseActions.buscarOrcamento,
        description: 'Busca orçamento salvo no banco de dados',
        params: ['termo', 'data', 'cliente'],
        category: 'trabalho',
        difficulty: 'facil'
    },
    'listar_orcamentos': {
        handler: databaseActions.listarOrcamentos,
        description: 'Lista todos os orçamentos salvos',
        params: ['filtro', 'limite'],
        category: 'trabalho',
        difficulty: 'facil'
    },

    // === PLANILHAS ===
    'criar_planilha': {
        handler: planilhaActions.criar,
        description: 'Cria nova planilha no Google Drive',
        params: ['nome', 'dados'],
        category: 'trabalho',
        difficulty: 'medio'
    },
    'atualizar_planilha': {
        handler: planilhaActions.atualizar,
        description: 'Atualiza planilha existente',
        params: ['planilha_id', 'dados', 'aba'],
        category: 'trabalho',
        difficulty: 'medio'
    },
    'ler_planilha': {
        handler: planilhaActions.ler,
        description: 'Lê dados de uma planilha',
        params: ['planilha_id', 'range'],
        category: 'trabalho',
        difficulty: 'medio'
    },

    // === WEB SCRAPING ===
    'buscar_produto_saintyco': {
        handler: scrapingActions.buscarSaintyco,
        description: 'Busca produto no site Saintyco',
        params: ['termo', 'categoria'],
        category: 'trabalho',
        difficulty: 'medio'
    },
    'buscar_produto_countec': {
        handler: scrapingActions.buscarCountec,
        description: 'Busca produto no site Countec',
        params: ['termo', 'categoria'],
        category: 'trabalho',
        difficulty: 'medio'
    },
    'baixar_arquivo_site': {
        handler: scrapingActions.baixarArquivo,
        description: 'Baixa PDF/documento de um site',
        params: ['url', 'tipo'],
        category: 'trabalho',
        difficulty: 'avancado'
    },

    // === BANCO DE DADOS ===
    'salvar_orcamento': {
        handler: databaseActions.salvarOrcamento,
        description: 'Salva orçamento no banco de dados local',
        params: ['orcamento', 'imagens', 'specs'],
        category: 'trabalho',
        difficulty: 'facil'
    },
    'buscar_specs_produto': {
        handler: databaseActions.buscarSpecs,
        description: 'Busca especificações técnicas de produto',
        params: ['produto', 'fabricante'],
        category: 'trabalho',
        difficulty: 'facil'
    },

    // === JACE.AI (Emails) ===
    'consultar_emails': {
        handler: jaceActions.consultarEmails,
        description: 'Consulta emails via Jace.AI',
        params: ['termo', 'remetente', 'data'],
        category: 'trabalho',
        difficulty: 'avancado'
    },
    'resumir_email': {
        handler: jaceActions.resumirEmail,
        description: 'Pede resumo de email específico',
        params: ['assunto', 'remetente'],
        category: 'trabalho',
        difficulty: 'avancado'
    }
};

// Executor de ações
export async function executeAction(actionName, params) {
    const action = actionsRegistry[actionName];

    if (!action) {
        return {
            success: false,
            error: `Ação "${actionName}" não encontrada`,
            availableActions: Object.keys(actionsRegistry)
        };
    }

    try {
        console.log(`[DOCE] Executando ação: ${actionName}`, params);
        const result = await action.handler(params);

        return {
            success: true,
            action: actionName,
            result
        };
    } catch (error) {
        console.error(`[DOCE] Erro na ação ${actionName}:`, error);
        return {
            success: false,
            action: actionName,
            error: error.message
        };
    }
}

// Lista ações por categoria
export function getActionsByCategory(category) {
    return Object.entries(actionsRegistry)
        .filter(([_, action]) => action.category === category)
        .map(([name, action]) => ({
            name,
            description: action.description,
            difficulty: action.difficulty
        }));
}
