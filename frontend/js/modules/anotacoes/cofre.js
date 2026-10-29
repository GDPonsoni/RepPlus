import { api } from '../../core/api.js';
import { emitir } from '../../core/eventos.js';

// Cofre de senhas: os segredos são cifrados AQUI, no navegador, antes de ir para o servidor.
//
//   senha do cofre --PBKDF2-SHA256--> chave da senha (KEK) --AES-GCM--> chave dos segredos (DEK)
//   DEK --AES-GCM--> cada segredo ("v1.<iv>.<conteúdo>", base64)
//
// O banco guarda só o salt, o número de iterações e a DEK cifrada. Trocar a senha re-cifra
// apenas a DEK. A "prova" (SHA-256 da DEK + texto fixo) mostra ao servidor que quem grava
// destrancou o cofre, sem revelar a chave. A DEK fica só na memória: recarregar a página ou
// ficar parado tranca o cofre de novo.

const ITERACOES = 600000;
const TEXTO_PROVA = 'escala-cofre-prova';
const TRANCAR_APOS_MS = 10 * 60 * 1000;

const estado = {
    config: null,      // { existe, salt, iteracoes, chaveCifrada } vindo do servidor
    chave: null,       // CryptoKey AES-GCM (DEK) quando destrancado
    chaveBruta: null,  // bytes da DEK (para trocar a senha)
    prova: null,
    timer: null
};

// Web Crypto só existe em conexão segura (https ou localhost)
export const cofreDisponivel = () => Boolean(globalThis.crypto?.subtle);
export const cofreExiste = () => Boolean(estado.config?.existe);
export const cofreDestrancado = () => Boolean(estado.chave);
export const provaDoCofre = () => estado.prova;

const paraBase64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const deBase64 = (texto) => Uint8Array.from(atob(texto), c => c.charCodeAt(0));
const utf8 = new TextEncoder();

async function chaveDaSenha(senha, salt, iteracoes) {
    const base = await crypto.subtle.importKey('raw', utf8.encode(senha), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
        { name: 'PBKDF2', hash: 'SHA-256', salt: deBase64(salt), iterations: iteracoes },
        base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
    );
}

async function cifrarBytes(chave, bytes) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const conteudo = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, chave, bytes);
    return `v1.${paraBase64(iv)}.${paraBase64(conteudo)}`;
}

async function decifrarBytes(chave, texto) {
    const [versao, iv, conteudo] = String(texto).split('.');
    if (versao !== 'v1') throw new Error('Formato de segredo desconhecido');
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv: deBase64(iv) }, chave, deBase64(conteudo));
}

async function calcularProva(chaveBruta) {
    const dados = new Uint8Array([...chaveBruta, ...utf8.encode(TEXTO_PROVA)]);
    return paraBase64(await crypto.subtle.digest('SHA-256', dados));
}

async function guardarChave(chaveBruta) {
    estado.chaveBruta = chaveBruta;
    estado.chave = await crypto.subtle.importKey('raw', chaveBruta, 'AES-GCM', false, ['encrypt', 'decrypt']);
    estado.prova = await calcularProva(chaveBruta);
    adiarTrancamento();
    emitir('cofre:mudou');
}

function adiarTrancamento() {
    clearTimeout(estado.timer);
    estado.timer = setTimeout(trancarCofre, TRANCAR_APOS_MS);
}

export async function carregarCofre() {
    estado.config = await api('/anotacoes/cofre');
    return estado.config;
}

export function trancarCofre() {
    clearTimeout(estado.timer);
    estado.chave = null;
    estado.chaveBruta = null;
    estado.prova = null;
    emitir('cofre:mudou');
}

export async function criarCofre(senha) {
    const chaveBruta = crypto.getRandomValues(new Uint8Array(32));
    const salt = paraBase64(crypto.getRandomValues(new Uint8Array(16)));
    const chaveCifrada = await cifrarBytes(await chaveDaSenha(senha, salt, ITERACOES), chaveBruta);
    const prova = await calcularProva(chaveBruta);
    await api('/anotacoes/cofre', { metodo: 'POST', corpo: { salt, iteracoes: ITERACOES, chaveCifrada, prova } });
    estado.config = { existe: true, salt, iteracoes: ITERACOES, chaveCifrada };
    await guardarChave(chaveBruta);
}

// Senha errada = a AES-GCM recusa decifrar a chave
export async function destrancarCofre(senha) {
    const { salt, iteracoes, chaveCifrada } = estado.config;
    let chaveBruta;
    try {
        chaveBruta = new Uint8Array(await decifrarBytes(await chaveDaSenha(senha, salt, iteracoes), chaveCifrada));
    } catch {
        throw new Error('Senha do cofre incorreta');
    }
    await guardarChave(chaveBruta);
}

export async function trocarSenhaDoCofre(novaSenha) {
    if (!estado.chaveBruta) throw new Error('Destranque o cofre primeiro');
    const salt = paraBase64(crypto.getRandomValues(new Uint8Array(16)));
    const chaveCifrada = await cifrarBytes(await chaveDaSenha(novaSenha, salt, ITERACOES), estado.chaveBruta);
    await api('/anotacoes/cofre', { metodo: 'PUT', corpo: { salt, iteracoes: ITERACOES, chaveCifrada, prova: estado.prova } });
    estado.config = { existe: true, salt, iteracoes: ITERACOES, chaveCifrada };
}

export async function apagarCofre() {
    const resultado = await api('/anotacoes/cofre', { metodo: 'DELETE' });
    estado.config = { existe: false };
    trancarCofre();
    return resultado;
}

// Objeto -> texto cifrado (null se não houver nada para guardar)
export async function cifrar(objeto) {
    const preenchido = Object.fromEntries(Object.entries(objeto).filter(([, valor]) => valor));
    if (!Object.keys(preenchido).length) return null;
    adiarTrancamento();
    return cifrarBytes(estado.chave, utf8.encode(JSON.stringify(preenchido)));
}

export async function decifrar(texto) {
    adiarTrancamento();
    return JSON.parse(new TextDecoder().decode(await decifrarBytes(estado.chave, texto)));
}
