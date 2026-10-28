// Ações de clique por delegação: em vez de onclick="funcaoGlobal()", o HTML usa
// <button data-acao="editar-comodo" data-id="..."> e o módulo registra o que a ação faz.
// O handler recebe o dataset do elemento (ex.: { acao, id }) e o próprio elemento.
const acoes = {};

export function registrarAcoes(mapa) {
    for (const nome of Object.keys(mapa)) {
        if (acoes[nome]) throw new Error(`Ação duplicada: ${nome}`);
    }
    Object.assign(acoes, mapa);
}

document.addEventListener('click', (evento) => {
    const elemento = evento.target.closest('[data-acao]');
    if (!elemento) return;
    const handler = acoes[elemento.dataset.acao];
    if (!handler) return;
    evento.preventDefault();
    handler(elemento.dataset, elemento);
});
