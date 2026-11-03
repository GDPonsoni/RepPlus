import { carregarSessao, moduloAtivo } from './core/sessao.js';
import { carregarConfig } from './core/aparencia.js';
import { montarInterface, iniciarNavegacao } from './core/shell.js';
import inicio, { definirModulosDoInicio } from './core/inicio.js';
import { definirModulosDosAvisos, iniciarAvisos } from './core/avisos.js';
import { ouvir } from './core/eventos.js';
import { mostrarEntrada } from './core/entrada.js';
import moradores from './core/moradores.js';
import aparencia from './core/aparencia.js';
import categorias from './core/categorias.js';
import sistema, { definirCatalogoModulos } from './core/sistema.js';
import escala from './modules/escala/index.js';
import agenda from './modules/agenda/index.js';
import compras from './modules/compras/index.js';
import anotacoes from './modules/anotacoes/index.js';
import atas from './modules/atas/index.js';
import financas from './modules/financas/index.js';

// Ordem dos módulos = ordem no seletor de módulos e das seções na página de Ajustes.
// Para adicionar um módulo novo: criar modules/<nome>/index.js e incluí-lo aqui
// (e o módulo correspondente no backend, em backend/app.js).
const MODULOS = [inicio, escala, agenda, compras, anotacoes, atas, financas, moradores, aparencia, categorias, sistema];

async function iniciar() {
    // Sessão primeiro: define quais módulos aparecem e quais botões cada usuário vê.
    // Sem sessão (login ligado e ninguém entrou), só a tela de entrada aparece
    if (!await carregarSessao()) return mostrarEntrada();
    // Módulos só do frontend (semBackend, ex.: Início) estão sempre ativos
    const ativos = MODULOS.filter(modulo => modulo.semBackend || moduloAtivo(modulo.id));
    definirCatalogoModulos(MODULOS);
    definirModulosDoInicio(ativos);
    definirModulosDosAvisos(ativos);

    montarInterface(ativos);
    await carregarConfig();

    // Cada módulo liga seus eventos e carrega seus dados; um módulo com erro não derruba os outros
    const resultados = await Promise.allSettled(ativos.map(modulo => modulo.iniciar?.()));
    resultados.forEach((resultado, i) => {
        if (resultado.status === 'rejected') console.error(`Erro ao iniciar o módulo ${ativos[i].id}:`, resultado.reason);
    });

    iniciarNavegacao();
    iniciarAvisos();
}

// O backend respondeu 401 no meio do uso (sessão venceu ou a senha da casa mudou)
ouvir('sessao:expirada', mostrarEntrada);

iniciar();
