/**
 * DOCE.AI - Ações de Orçamentos
 * Integração com o sistema Local Orçamentos
 */

// Configuração do Local Orçamentos
// TODO: Substituir pela URL real do seu site
const LOCAL_ORCAMENTOS_URL = 'https://seu-local-orcamentos.vercel.app';

export const orcamentoActions = {
    /**
     * Gerar novo orçamento via Local Orçamentos
     * Pode funcionar via:
     * 1. API (se você adicionar endpoints no Local Orçamentos)
     * 2. Iframe (abre o site dentro do chat)
     * 3. Redirect (abre em nova aba com parâmetros)
     */
    async gerar(params) {
        const { cliente, itens, imagens, modo = 'iframe' } = params;

        // Montar dados do orçamento
        const dadosOrcamento = {
            cliente: cliente || '',
            itens: itens || [],
            imagens: imagens || [],
            origem: 'doce_ai',
            timestamp: new Date().toISOString()
        };

        switch (modo) {
            case 'api':
                return await this.gerarViaAPI(dadosOrcamento);

            case 'iframe':
                return this.gerarViaIframe(dadosOrcamento);

            case 'redirect':
                return this.gerarViaRedirect(dadosOrcamento);

            default:
                return this.gerarViaIframe(dadosOrcamento);
        }
    },

    /**
     * Modo API - Chama endpoint do Local Orçamentos
     * Requer que você adicione uma API no Local Orçamentos
     */
    async gerarViaAPI(dados) {
        try {
            const response = await fetch(`${LOCAL_ORCAMENTOS_URL}/api/orcamento`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(dados)
            });

            if (!response.ok) {
                throw new Error('Falha ao criar orçamento via API');
            }

            const resultado = await response.json();

            return {
                success: true,
                modo: 'api',
                message: 'Orçamento criado com sucesso!',
                orcamento: resultado,
                url: `${LOCAL_ORCAMENTOS_URL}/orcamento/${resultado.id}`
            };
        } catch (error) {
            console.error('[ORÇAMENTO] Erro API:', error);
            // Fallback para iframe
            return this.gerarViaIframe(dados);
        }
    },

    /**
     * Modo Iframe - Abre Local Orçamentos em modal
     */
    gerarViaIframe(dados) {
        // Codificar dados para passar via URL
        const params = new URLSearchParams({
            cliente: dados.cliente || '',
            origem: 'doce_ai',
            dados: JSON.stringify(dados.itens || [])
        });

        const iframeUrl = `${LOCAL_ORCAMENTOS_URL}?${params.toString()}`;

        return {
            success: true,
            modo: 'iframe',
            message: 'Abrindo Local Orçamentos...',
            action: 'open_iframe',
            url: iframeUrl,
            dados: dados
        };
    },

    /**
     * Modo Redirect - Abre em nova aba
     */
    gerarViaRedirect(dados) {
        const params = new URLSearchParams({
            cliente: dados.cliente || '',
            origem: 'doce_ai'
        });

        const url = `${LOCAL_ORCAMENTOS_URL}?${params.toString()}`;

        return {
            success: true,
            modo: 'redirect',
            message: 'Redirecionando para Local Orçamentos...',
            action: 'open_tab',
            url: url
        };
    },

    /**
     * Importar orçamento do Local Orçamentos para o banco local
     */
    async importar(params) {
        const { orcamento_id, url } = params;

        // Se tiver API
        try {
            const response = await fetch(`${LOCAL_ORCAMENTOS_URL}/api/orcamento/${orcamento_id}`);

            if (response.ok) {
                const orcamento = await response.json();

                return {
                    success: true,
                    message: 'Orçamento importado!',
                    orcamento
                };
            }
        } catch (error) {
            console.log('[ORÇAMENTO] API não disponível, tentando scraping...');
        }

        // Fallback - retorna instruções para importação manual
        return {
            success: false,
            message: 'Não consegui importar automaticamente.',
            sugestao: 'Por favor, exporte o orçamento do Local Orçamentos e cole aqui os dados.'
        };
    },

    /**
     * Calcular valor de orçamento
     */
    calcular(params) {
        const { itens, desconto = 0, imposto = 0 } = params;

        let subtotal = 0;

        const itensCalculados = itens.map(item => {
            const valorItem = (item.preco || 0) * (item.quantidade || 1);
            subtotal += valorItem;

            return {
                ...item,
                valor_total: valorItem
            };
        });

        const valorDesconto = subtotal * (desconto / 100);
        const valorComDesconto = subtotal - valorDesconto;
        const valorImposto = valorComDesconto * (imposto / 100);
        const valorFinal = valorComDesconto + valorImposto;

        return {
            itens: itensCalculados,
            subtotal,
            desconto: { percentual: desconto, valor: valorDesconto },
            imposto: { percentual: imposto, valor: valorImposto },
            total: valorFinal
        };
    },

    /**
     * Formatar orçamento para exibição
     */
    formatar(orcamento) {
        const linhas = [
            `📋 **ORÇAMENTO**`,
            `━━━━━━━━━━━━━━━━━━━━`,
            `**Cliente:** ${orcamento.cliente || 'Não informado'}`,
            `**Data:** ${new Date(orcamento.criado_em).toLocaleDateString('pt-BR')}`,
            ``,
            `**Itens:**`
        ];

        if (orcamento.itens && orcamento.itens.length > 0) {
            orcamento.itens.forEach((item, i) => {
                linhas.push(`${i + 1}. ${item.nome} - ${item.quantidade}x - R$ ${item.preco?.toFixed(2) || '0.00'}`);
            });
        } else {
            linhas.push(`(Nenhum item)`);
        }

        linhas.push(``);
        linhas.push(`━━━━━━━━━━━━━━━━━━━━`);
        linhas.push(`**TOTAL: R$ ${orcamento.valor_total?.toFixed(2) || '0.00'}**`);

        return linhas.join('\n');
    }
};

// Configuração - Exportar para atualização
export function setLocalOrcamentosURL(url) {
    // Em produção, isso seria salvo em config
    console.log(`[CONFIG] Local Orçamentos URL: ${url}`);
}
