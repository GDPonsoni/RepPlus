// Barramento de eventos entre módulos, para um módulo reagir a outro sem importá-lo.
// Ex.: moradores emite 'moradores:atualizados' e a escala atualiza o select de infrações.
const alvo = new EventTarget();

export function emitir(nome, detalhe) {
    alvo.dispatchEvent(new CustomEvent(nome, { detail: detalhe }));
}

export function ouvir(nome, callback) {
    alvo.addEventListener(nome, (evento) => callback(evento.detail));
}
