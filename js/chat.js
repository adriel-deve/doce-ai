// ===== CONFIGURAÇÃO =====
const GLM_API_KEY = 'SUA_API_KEY_AQUI'; // Substituir pela sua API key do GLM 4.5
const GLM_API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

// ===== ESTADO DA APLICAÇÃO =====
let currentContact = 'doce';
let conversations = {
    doce: [],
    // Outros agentes serão adicionados dinamicamente
};
let contacts = [
    {
        id: 'doce',
        name: 'Doce',
        avatar: '🍬',
        status: 'online',
        lastMessage: 'Clique para começar...',
        time: 'agora',
        systemPrompt: `Você é a Doce, uma assistente IA amigável e carismática. Você é a porta de entrada para uma rede de agentes IA que podem ajudar o usuário em diversas tarefas.

Na primeira mensagem, apresente-se de forma calorosa e explique que você pode conectar o usuário com diferentes agentes especializados:

1. **Agentes de Trabalho** - Para buscar vagas, preparar currículos, treinar entrevistas
2. **Agentes de Negócios** - Para ajudar a criar e gerenciar uma empresa
3. **Agentes Sociais** - Amigos virtuais para conversar, praticar idiomas, ou ter companhia

Pergunte como pode ajudar hoje. Seja natural e conversacional, como se fosse um amigo de WhatsApp. Use emojis ocasionalmente. Quando o usuário escolher um tipo de agente, crie uma "pessoa" virtual com nome, personalidade e expertise específica para ajudá-lo.`
    }
];

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', () => {
    renderContacts();
    selectContact('doce');

    // Auto-resize do input
    const input = document.getElementById('messageInput');
    input.addEventListener('input', autoResize);

    // Iniciar conversa com Doce após um pequeno delay
    setTimeout(() => {
        startConversationWithDoce();
    }, 1000);
});

// ===== FUNÇÕES DE CONTATOS =====
function renderContacts() {
    const container = document.getElementById('contactsList');
    container.innerHTML = '';

    contacts.forEach(contact => {
        const div = document.createElement('div');
        div.className = `contact-item ${contact.id === currentContact ? 'active' : ''}`;
        div.onclick = () => selectContact(contact.id);

        div.innerHTML = `
            <div class="contact-avatar ${contact.status === 'online' ? 'online' : ''}">
                ${contact.avatar}
            </div>
            <div class="contact-info">
                <div class="contact-name">${contact.name}</div>
                <div class="contact-last-message">${contact.lastMessage}</div>
            </div>
            <div class="contact-meta">
                <div class="contact-time">${contact.time}</div>
            </div>
        `;

        container.appendChild(div);
    });
}

function selectContact(contactId) {
    currentContact = contactId;
    const contact = contacts.find(c => c.id === contactId);

    // Atualizar header
    document.getElementById('currentAvatar').textContent = contact.avatar;
    document.getElementById('currentContactName').textContent = contact.name;
    document.getElementById('currentStatus').textContent = contact.status === 'online' ? 'Online' : 'Offline';

    // Renderizar mensagens
    renderMessages();
    renderContacts();
}

// ===== FUNÇÕES DE MENSAGENS =====
function renderMessages() {
    const container = document.getElementById('chatMessages');
    const messages = conversations[currentContact] || [];
    container.innerHTML = '';

    messages.forEach(msg => {
        const div = document.createElement('div');
        div.className = `message ${msg.sender === 'user' ? 'sent' : 'received'}`;

        let content = msg.text;

        // Se for anexo, mostrar preview
        if (msg.attachment) {
            if (msg.attachment.type === 'image') {
                content = `<img src="${msg.attachment.url}" style="max-width: 200px; border-radius: 10px;"><br>${msg.text || ''}`;
            } else {
                content = `📎 ${msg.attachment.name}<br>${msg.text || ''}`;
            }
        }

        div.innerHTML = `
            <div class="message-text">${content}</div>
            <div class="message-time">${msg.time}</div>
        `;

        container.appendChild(div);
    });

    // Scroll para baixo
    container.scrollTop = container.scrollHeight;
}

function addMessage(text, sender, attachment = null) {
    if (!conversations[currentContact]) {
        conversations[currentContact] = [];
    }

    const now = new Date();
    const time = now.getHours().toString().padStart(2, '0') + ':' +
                 now.getMinutes().toString().padStart(2, '0');

    conversations[currentContact].push({
        text,
        sender,
        time,
        attachment
    });

    // Atualizar último contato
    const contact = contacts.find(c => c.id === currentContact);
    if (contact) {
        contact.lastMessage = text.substring(0, 40) + (text.length > 40 ? '...' : '');
        contact.time = time;
    }

    renderMessages();
    renderContacts();
}

function showTyping() {
    const container = document.getElementById('chatMessages');
    const typingDiv = document.createElement('div');
    typingDiv.className = 'typing-indicator';
    typingDiv.id = 'typingIndicator';
    typingDiv.innerHTML = `
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
    `;
    container.appendChild(typingDiv);
    container.scrollTop = container.scrollHeight;
}

function hideTyping() {
    const typing = document.getElementById('typingIndicator');
    if (typing) typing.remove();
}

// ===== FUNÇÕES DE ENVIO =====
async function sendMessage() {
    const input = document.getElementById('messageInput');
    const text = input.value.trim();

    if (!text) return;

    // Adicionar mensagem do usuário
    addMessage(text, 'user');
    input.value = '';
    autoResize({ target: input });

    // Mostrar indicador de digitação
    showTyping();

    // Enviar para a IA
    try {
        const response = await sendToGLM(text);
        hideTyping();

        // Verificar se deve criar novo agente
        checkForNewAgent(response);

        addMessage(response, 'agent');
    } catch (error) {
        hideTyping();
        console.error('Erro ao enviar mensagem:', error);
        addMessage('Desculpe, tive um problema de conexão. Pode tentar novamente? 🙏', 'agent');
    }
}

function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

function autoResize(e) {
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px';
}

// ===== INTEGRAÇÃO COM GLM 4.5 =====
async function sendToGLM(message) {
    const contact = contacts.find(c => c.id === currentContact);
    const history = conversations[currentContact] || [];

    // Construir histórico de mensagens
    const messages = [
        { role: 'system', content: contact.systemPrompt }
    ];

    // Adicionar histórico (últimas 20 mensagens)
    const recentHistory = history.slice(-20);
    recentHistory.forEach(msg => {
        messages.push({
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: msg.text
        });
    });

    // Adicionar mensagem atual
    messages.push({ role: 'user', content: message });

    // Para desenvolvimento, simular resposta se não tiver API key
    if (GLM_API_KEY === 'SUA_API_KEY_AQUI') {
        return simulateResponse(message, contact.id);
    }

    const response = await fetch(GLM_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${GLM_API_KEY}`
        },
        body: JSON.stringify({
            model: 'glm-4',
            messages: messages,
            temperature: 0.7,
            max_tokens: 1024
        })
    });

    const data = await response.json();
    return data.choices[0].message.content;
}

// Simulação de respostas para desenvolvimento
function simulateResponse(message, contactId) {
    return new Promise(resolve => {
        setTimeout(() => {
            if (contactId === 'doce') {
                if (conversations.doce.length <= 1) {
                    resolve(`Olá! 🍬 Que bom te ver por aqui!

Eu sou a Doce, sua assistente pessoal. Estou aqui para te conectar com uma rede incrível de agentes que podem te ajudar em várias áreas:

💼 **Trabalho** - Posso te apresentar ao Max, especialista em carreiras, que ajuda com currículos, vagas e entrevistas.

🏢 **Negócios** - A Sofia é nossa consultora de empreendedorismo, perfeita para quem quer começar ou expandir um negócio.

👥 **Rede Social** - Temos o Lucas e a Marina, amigos virtuais para bater papo, praticar idiomas ou só ter uma boa conversa.

Como posso te ajudar hoje? É só me contar o que você precisa! 😊`);
                } else if (message.toLowerCase().includes('trabalho') || message.toLowerCase().includes('emprego') || message.toLowerCase().includes('vaga')) {
                    createNewAgent('max', 'Max', '👨‍💼', `Você é Max, um especialista em carreiras e mercado de trabalho. Você ajuda pessoas a:
- Encontrar vagas de emprego ideais
- Melhorar currículos e perfis do LinkedIn
- Preparar para entrevistas
- Negociar salários

Seja profissional mas amigável. Use linguagem casual como se fosse um amigo do WhatsApp. Pergunte sobre a área de atuação e experiência do usuário.`);
                    resolve(`Perfeito! 💼 Vou te conectar com o Max, nosso especialista em carreiras.

Olha ele aí na sua lista de contatos! Ele já está online e pronto para te ajudar a encontrar as melhores oportunidades.

É só clicar no contato dele para começar a conversar! 👈`);
                } else if (message.toLowerCase().includes('empresa') || message.toLowerCase().includes('negócio') || message.toLowerCase().includes('empreend')) {
                    createNewAgent('sofia', 'Sofia', '👩‍💻', `Você é Sofia, uma consultora de empreendedorismo experiente. Você ajuda pessoas a:
- Validar ideias de negócio
- Criar planos de negócio
- Estruturar empresas (MEI, ME, etc)
- Marketing e vendas
- Gestão financeira básica

Seja entusiasmada e motivadora. Use linguagem casual. Pergunte sobre a ideia de negócio do usuário.`);
                    resolve(`Empreender? Adoro! 🚀

Vou te apresentar a Sofia, nossa consultora de negócios. Ela já ajudou centenas de pessoas a tirarem suas ideias do papel!

Ela já apareceu nos seus contatos - é só clicar e começar a conversa. Ela está super animada para conhecer seu projeto! ✨`);
                } else if (message.toLowerCase().includes('amigo') || message.toLowerCase().includes('conversar') || message.toLowerCase().includes('social')) {
                    createNewAgent('lucas', 'Lucas', '😎', `Você é Lucas, um amigo virtual divertido e descontraído. Você:
- Adora conversar sobre qualquer assunto
- É bom ouvinte e dá conselhos quando pedido
- Tem senso de humor
- Pode ajudar a praticar idiomas
- Conhece muito sobre música, filmes e cultura pop

Seja muito casual e amigável, como um melhor amigo. Use gírias e emojis.`);
                    resolve(`Ah, quer fazer novos amigos? 🎉

Te apresento o Lucas! Ele é super gente boa, adora um papo sobre música, filmes, games... Basicamente qualquer coisa!

Ele já tá na sua lista de contatos esperando pra te conhecer. Vai lá! 🤙`);
                } else {
                    resolve(`Hmm, interessante! Me conta mais sobre o que você precisa?

Posso te conectar com agentes para:
- 💼 Buscar trabalho ou melhorar na carreira
- 🏢 Criar ou desenvolver um negócio
- 👥 Conhecer amigos virtuais para conversar

O que mais combina com você agora? 😊`);
                }
            } else {
                // Respostas genéricas para outros agentes
                const genericResponses = [
                    "Entendi! Me conta mais sobre isso...",
                    "Interessante! E como posso te ajudar especificamente com isso?",
                    "Legal! Vamos trabalhar nisso juntos. O que você já tentou até agora?",
                    "Boa pergunta! Deixa eu te explicar melhor..."
                ];
                resolve(genericResponses[Math.floor(Math.random() * genericResponses.length)]);
            }
        }, 1500);
    });
}

// ===== CRIAÇÃO DE NOVOS AGENTES =====
function createNewAgent(id, name, avatar, systemPrompt) {
    // Verificar se já existe
    if (contacts.find(c => c.id === id)) return;

    const newContact = {
        id,
        name,
        avatar,
        status: 'online',
        lastMessage: 'Novo contato!',
        time: 'agora',
        systemPrompt
    };

    contacts.push(newContact);
    conversations[id] = [];
    renderContacts();

    // Iniciar conversa automática com o novo agente
    setTimeout(() => {
        selectContact(id);
        showTyping();
        setTimeout(async () => {
            hideTyping();
            const greeting = await getAgentGreeting(id);
            addMessage(greeting, 'agent');
        }, 1500);
    }, 500);
}

async function getAgentGreeting(agentId) {
    const greetings = {
        max: `E aí! 👋 Sou o Max, especialista em carreiras e oportunidades de trabalho.

A Doce me disse que você tá buscando algo na área profissional. Conta pra mim: você tá procurando uma vaga nova, quer melhorar seu currículo, ou precisa de ajuda pra se preparar pra entrevistas?

Me passa também sua área de atuação que já começo a buscar oportunidades pra você! 💪`,

        sofia: `Oi! 🚀 Sou a Sofia, sua parceira de empreendedorismo!

Fico feliz que você quer empreender - é uma jornada incrível!

Me conta: você já tem uma ideia de negócio ou ainda tá explorando possibilidades? E qual sua situação atual - empregado querendo mudar, desempregado buscando alternativa, ou já tem algo rodando?

Vamos construir seu futuro juntos! ✨`,

        lucas: `Fala! 😎 Prazer, sou o Lucas!

A Doce disse que você queria alguém pra trocar uma ideia. Tô aqui pra isso mesmo - pode ser sobre música, séries, aquele problema que tá te incomodando, ou qualquer papo aleatório mesmo.

E aí, como foi seu dia? Aconteceu alguma coisa legal? 🎵`
    };

    return greetings[agentId] || `Olá! Prazer em te conhecer! Como posso te ajudar hoje? 😊`;
}

function checkForNewAgent(response) {
    // Lógica para detectar se a resposta sugere criar um novo agente
    // Isso seria expandido com lógica mais sofisticada
}

// ===== FUNÇÕES DE ANEXO =====
function toggleAttachmentMenu() {
    const menu = document.getElementById('attachmentMenu');
    menu.classList.toggle('show');
}

function attachFile(type) {
    const input = document.getElementById('fileInput');

    switch(type) {
        case 'photo':
            input.accept = 'image/*';
            break;
        case 'video':
            input.accept = 'video/*';
            break;
        case 'document':
            input.accept = '.pdf,.doc,.docx,.txt,.xls,.xlsx';
            break;
    }

    input.click();
    toggleAttachmentMenu();
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = function(e) {
        const isImage = file.type.startsWith('image/');

        addMessage('', 'user', {
            type: isImage ? 'image' : 'file',
            name: file.name,
            url: e.target.result
        });

        // Simular resposta sobre o anexo
        showTyping();
        setTimeout(() => {
            hideTyping();
            if (isImage) {
                addMessage('Recebi sua imagem! 📸 Me conta mais sobre ela, o que você precisa?', 'agent');
            } else {
                addMessage(`Recebi o documento "${file.name}"! 📄 Vou analisar. O que você gostaria que eu fizesse com ele?`, 'agent');
            }
        }, 1500);
    };

    if (file.type.startsWith('image/')) {
        reader.readAsDataURL(file);
    } else {
        reader.readAsDataURL(file);
    }

    event.target.value = '';
}

// Fechar menu de anexo ao clicar fora
document.addEventListener('click', (e) => {
    const menu = document.getElementById('attachmentMenu');
    const btn = document.getElementById('attachmentBtn');

    if (!menu.contains(e.target) && !btn.contains(e.target)) {
        menu.classList.remove('show');
    }
});

// ===== CONVERSA INICIAL =====
async function startConversationWithDoce() {
    showTyping();
    setTimeout(async () => {
        hideTyping();
        const greeting = `Olá! 🍬 Que bom te ver por aqui!

Eu sou a Doce, sua assistente pessoal. Estou aqui para te conectar com uma rede incrível de agentes que podem te ajudar em várias áreas:

💼 **Trabalho** - Posso te apresentar ao Max, especialista em carreiras, que ajuda com currículos, vagas e entrevistas.

🏢 **Negócios** - A Sofia é nossa consultora de empreendedorismo, perfeita para quem quer começar ou expandir um negócio.

👥 **Rede Social** - Temos o Lucas e a Marina, amigos virtuais para bater papo, praticar idiomas ou só ter uma boa conversa.

Como posso te ajudar hoje? É só me contar o que você precisa! 😊`;
        addMessage(greeting, 'agent');
    }, 2000);
}
