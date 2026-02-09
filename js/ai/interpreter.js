/**
 * DOCE.AI - Interpretador de Intenções
 * Usa Gemini Flash para classificar a intenção do usuário
 * e executar a ação correspondente
 */

import { actionsRegistry, executeAction } from '../actions/index.js';

// Configuração do Gemini
const GEMINI_API_KEY = ''; // Sua API Key do Google AI Studio
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

// Lista de ações disponíveis para o prompt
function getActionsPrompt() {
    return Object.entries(actionsRegistry).map(([name, action]) => {
        return `- ${name}: ${action.description} (params: ${action.params.join(', ')})`;
    }).join('\n');
}

// System prompt para interpretação
const SYSTEM_PROMPT = `Você é um interpretador de intenções para o sistema Doce.AI.
Sua tarefa é analisar a mensagem do usuário e identificar:
1. A AÇÃO que ele quer executar
2. Os PARÂMETROS necessários

AÇÕES DISPONÍVEIS:
${getActionsPrompt()}

REGRAS:
- Responda APENAS em JSON válido
- Se não conseguir identificar a ação, use "action": "conversa_livre"
- Extraia todos os parâmetros mencionados pelo usuário
- Se faltar informação, inclua em "missing_params"

FORMATO DE RESPOSTA:
{
    "action": "nome_da_acao",
    "params": {
        "param1": "valor1",
        "param2": "valor2"
    },
    "missing_params": ["param_faltando"],
    "confidence": 0.95,
    "message": "Mensagem amigável para o usuário"
}

EXEMPLOS:

Usuário: "Preciso fazer um orçamento para a empresa ABC"
{
    "action": "gerar_orcamento",
    "params": { "cliente": "empresa ABC" },
    "missing_params": ["itens"],
    "confidence": 0.9,
    "message": "Vou preparar o orçamento para a empresa ABC. Quais itens você quer incluir?"
}

Usuário: "Busca informações sobre tablet counting machine no saintyco"
{
    "action": "buscar_produto_saintyco",
    "params": { "termo": "tablet counting machine" },
    "missing_params": [],
    "confidence": 0.95,
    "message": "Buscando 'tablet counting machine' no Saintyco..."
}

Usuário: "Tem algum email do João sobre o projeto?"
{
    "action": "consultar_emails",
    "params": { "remetente": "João", "termo": "projeto" },
    "missing_params": [],
    "confidence": 0.85,
    "message": "Vou verificar os emails do João sobre o projeto."
}`;

export const interpreter = {
    /**
     * Interpretar mensagem do usuário
     */
    async interpretar(mensagem, contexto = {}) {
        // Se não tiver API key, usar interpretação local
        if (!GEMINI_API_KEY) {
            return this.interpretarLocal(mensagem, contexto);
        }

        try {
            const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: `${SYSTEM_PROMPT}\n\nMensagem do usuário: "${mensagem}"\n\nContexto: ${JSON.stringify(contexto)}`
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.1,
                        maxOutputTokens: 500,
                    }
                })
            });

            const data = await response.json();

            if (!data.candidates || !data.candidates[0]) {
                throw new Error('Resposta inválida do Gemini');
            }

            const textoResposta = data.candidates[0].content.parts[0].text;

            // Extrair JSON da resposta
            const jsonMatch = textoResposta.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }

            throw new Error('JSON não encontrado na resposta');
        } catch (error) {
            console.error('[INTERPRETER] Erro Gemini:', error);
            // Fallback para interpretação local
            return this.interpretarLocal(mensagem, contexto);
        }
    },

    /**
     * Interpretação local (sem IA)
     * Usa keywords para identificar ações
     */
    interpretarLocal(mensagem, contexto = {}) {
        const msg = mensagem.toLowerCase();

        // Padrões de detecção
        const patterns = [
            // Orçamentos
            {
                keywords: ['orçamento', 'orcamento', 'orçar', 'cotar'],
                action: 'gerar_orcamento',
                extractor: (m) => {
                    const cliente = m.match(/(?:para|cliente|empresa)\s+(.+?)(?:\s|$|,)/i);
                    return { cliente: cliente?.[1] || '' };
                }
            },
            // Buscar orçamento
            {
                keywords: ['buscar orçamento', 'encontrar orçamento', 'orçamento do', 'orçamento de'],
                action: 'buscar_orcamento',
                extractor: (m) => {
                    const termo = m.match(/(?:buscar|encontrar|orçamento)\s+(?:do|de|sobre)?\s*(.+)/i);
                    return { termo: termo?.[1] || '' };
                }
            },
            // Planilhas
            {
                keywords: ['criar planilha', 'nova planilha', 'planilha nova'],
                action: 'criar_planilha',
                extractor: (m) => {
                    const nome = m.match(/planilha\s+(?:de|para|chamada)?\s*(.+)/i);
                    return { nome: nome?.[1] || 'Nova Planilha' };
                }
            },
            {
                keywords: ['atualizar planilha', 'editar planilha', 'modificar planilha'],
                action: 'atualizar_planilha',
                extractor: () => ({})
            },
            // Saintyco
            {
                keywords: ['saintyco', 'buscar saintyco', 'pesquisar saintyco'],
                action: 'buscar_produto_saintyco',
                extractor: (m) => {
                    const termo = m.replace(/saintyco/gi, '').replace(/buscar|pesquisar|no|na|em/gi, '').trim();
                    return { termo };
                }
            },
            // Countec
            {
                keywords: ['countec', 'buscar countec', 'pesquisar countec'],
                action: 'buscar_produto_countec',
                extractor: (m) => {
                    const termo = m.replace(/countec/gi, '').replace(/buscar|pesquisar|no|na|em/gi, '').trim();
                    return { termo };
                }
            },
            // Emails / Jace
            {
                keywords: ['email', 'emails', 'jace', 'caixa de entrada'],
                action: 'consultar_emails',
                extractor: (m) => {
                    const remetente = m.match(/(?:de|do|da)\s+(\w+)/i);
                    const assunto = m.match(/sobre\s+(.+?)(?:\?|$)/i);
                    return {
                        remetente: remetente?.[1],
                        termo: assunto?.[1]
                    };
                }
            },
            // Listar orçamentos
            {
                keywords: ['listar orçamentos', 'meus orçamentos', 'todos orçamentos', 'ver orçamentos'],
                action: 'listar_orcamentos',
                extractor: () => ({ limite: 10 })
            },
            // Baixar arquivo
            {
                keywords: ['baixar', 'download', 'pdf', 'documento'],
                action: 'baixar_arquivo_site',
                extractor: (m) => {
                    const url = m.match(/https?:\/\/[^\s]+/);
                    return { url: url?.[0] };
                }
            }
        ];

        // Encontrar padrão correspondente
        for (const pattern of patterns) {
            if (pattern.keywords.some(kw => msg.includes(kw))) {
                const params = pattern.extractor(mensagem);

                return {
                    action: pattern.action,
                    params,
                    missing_params: [],
                    confidence: 0.7,
                    message: this.gerarMensagem(pattern.action, params),
                    method: 'local'
                };
            }
        }

        // Nenhum padrão encontrado - conversa livre
        return {
            action: 'conversa_livre',
            params: { mensagem },
            missing_params: [],
            confidence: 0.5,
            message: null,
            method: 'local'
        };
    },

    /**
     * Gerar mensagem amigável baseada na ação
     */
    gerarMensagem(action, params) {
        const mensagens = {
            'gerar_orcamento': `Vou preparar o orçamento${params.cliente ? ` para ${params.cliente}` : ''}...`,
            'buscar_orcamento': `Buscando orçamentos${params.termo ? ` sobre "${params.termo}"` : ''}...`,
            'criar_planilha': `Criando planilha "${params.nome || 'Nova'}"...`,
            'buscar_produto_saintyco': `Buscando "${params.termo}" no Saintyco...`,
            'buscar_produto_countec': `Buscando "${params.termo}" no Countec...`,
            'consultar_emails': `Verificando emails${params.remetente ? ` de ${params.remetente}` : ''}...`,
            'listar_orcamentos': 'Listando seus orçamentos...'
        };

        return mensagens[action] || 'Processando...';
    },

    /**
     * Processar mensagem completa (interpretar + executar)
     */
    async processar(mensagem, contexto = {}) {
        // 1. Interpretar intenção
        const intencao = await this.interpretar(mensagem, contexto);

        console.log('[INTERPRETER] Intenção detectada:', intencao);

        // 2. Se for conversa livre, não executar ação
        if (intencao.action === 'conversa_livre') {
            return {
                tipo: 'conversa',
                intencao,
                resposta: null // IA vai responder normalmente
            };
        }

        // 3. Verificar se faltam parâmetros
        if (intencao.missing_params && intencao.missing_params.length > 0) {
            return {
                tipo: 'incompleto',
                intencao,
                pergunta: `Para continuar, preciso saber: ${intencao.missing_params.join(', ')}`
            };
        }

        // 4. Executar ação
        const resultado = await executeAction(intencao.action, intencao.params);

        return {
            tipo: 'acao',
            intencao,
            resultado,
            mensagem: intencao.message
        };
    }
};

// Configuração da API Key
export function setGeminiApiKey(key) {
    // Em produção, isso viria de variável de ambiente
    console.log('[CONFIG] Gemini API Key configurada');
}
