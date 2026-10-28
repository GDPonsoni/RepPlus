import { carregarSessao, moduloAtivo } from './core/sessao.js';
import { carregarConfig } from './core/aparencia.js';
import { montarInterface, iniciarNavegacao } from './core/shell.js';
import { ouvir } from './core/eventos.js';
import { mostrarNotificacao } from './core/ui.js';
import moradores from './core/moradores.js';
import aparencia from './core/aparencia.js';
import sistema from './core/sistema.js';
import escala from './modules/escala/index.js';

// Ordem dos módulos = ordem das abas e das seções em Config.
// Para adicionar um módulo novo: criar modules/<nome>/index.js e incluí-lo aqui
// (e o módulo correspondente no backend, em backend/app.js).
const MODULOS = [moradores, escala, aparencia, sistema];

async function iniciar() {
    // Sessão primeiro: define quais módulos aparecem e quais botões cada usuário vê
    await carregarSessao();
    const ativos = MODULOS.filter(modulo => moduloAtivo(modulo.id));

    montarInterface(ativos);
    await carregarConfig();

    // Cada módulo liga seus eventos e carrega seus dados; um módulo com erro não derruba os outros
    const resultados = await Promise.allSettled(ativos.map(modulo => modulo.iniciar?.()));
    resultados.forEach((resultado, i) => {
        if (resultado.status === 'rejected') console.error(`Erro ao iniciar o módulo ${ativos[i].id}:`, resultado.reason);
    });

    iniciarNavegacao();
}

// Ponte para o login: quando o backend responder 401, aqui entrará o redirecionamento para a tela de entrada
ouvir('sessao:expirada', () => mostrarNotificacao('Sua sessão expirou. Entre novamente.', 'warning'));

iniciar();
