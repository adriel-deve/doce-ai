// Criar partículas flutuantes
function createParticles() {
    const container = document.getElementById('particles');
    const particleCount = 50;

    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.top = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 15 + 's';
        particle.style.animationDuration = (10 + Math.random() * 10) + 's';
        container.appendChild(particle);
    }
}

// Iniciar chat
function startChat() {
    const button = document.getElementById('startButton');
    button.innerHTML = '<span class="button-text">Carregando...</span>';
    button.style.pointerEvents = 'none';

    // Animação de saída
    document.querySelector('.welcome-container').style.animation = 'fadeOut 0.5s ease forwards';

    setTimeout(() => {
        window.location.href = 'chat.html';
    }, 500);
}

// Adicionar keyframes de fade out
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeOut {
        to {
            opacity: 0;
            transform: scale(0.95);
        }
    }
`;
document.head.appendChild(style);

// Inicializar
document.addEventListener('DOMContentLoaded', () => {
    createParticles();
});
