import { api } from '../../core/api.js';
import { escaparHtml } from '../../core/ui.js';
import { hoje } from '../../core/datas.js';
import { carregarCategorias } from '../../core/categorias.js';
import { estado, ESCOPO, reais, nomeDoMorador, saldosEntreMoradores, somarMeses, conta, dentro } from './dados.js';

// Resumo no Início: gasto do mês (contra o orçamento), disponível, reserva e quem deve para quem
export default {
    titulo: 'Finanças do mês',
    rota: 'financas/visao',
    permissao: 'financas:ver',

    async conteudo() {
        const mes = hoje().slice(0, 7);
        const [contas, transacoes, orcamentos, divisoes] = await Promise.all([
            api('/financas/contas'),
            api(`/financas/transacoes?de=${mes}-01&ate=${somarMeses(mes, 1)}-01`),
            api('/financas/orcamentos'),
            api('/financas/divisoes')
        ]);
        estado.divisoes = divisoes;
        await carregarCategorias(ESCOPO);

        const gastos = transacoes.filter(t => conta(t) && t.valor < 0);
        const gasto = gastos.reduce((s, t) => s - t.valor, 0);
        // Orçamento: compara só o que foi gasto nas categorias que têm limite
        const limite = orcamentos.reduce((s, o) => s + o.valorMensal, 0);
        // Cada gasto conta uma vez, se alguma categoria com limite o cobre (ela ou a principal dela)
        const gastoComLimite = gastos.filter(t => orcamentos.some(o => dentro(t.categoria, o.categoria))).reduce((s, t) => s - t.valor, 0);
        const ativas = contas.filter(c => !c.arquivada);
        const disponivel = ativas.filter(c => !c.reserva).reduce((s, c) => s + c.saldo, 0);
        const reserva = ativas.filter(c => c.reserva).reduce((s, c) => s + c.saldo, 0);
        const dividas = saldosEntreMoradores().slice(0, 3);
        const pct = limite ? Math.round((gastoComLimite / limite) * 100) : 0;

        return `
            <div class="inicio-fin-gasto">
                <span>Gasto até hoje</span>
                <strong>${reais(gasto)}</strong>
                ${limite ? `<small>Orçamento: ${reais(gastoComLimite)} de ${reais(limite)} (${pct}%)</small>
                    <div class="fin-progresso ${pct >= 100 ? 'estourou' : ''}"><span style="width: ${Math.min(100, pct)}%"></span></div>` : ''}
            </div>
            <div class="inicio-fin-saldos">
                <span><small>Disponível</small><strong>${reais(disponivel)}</strong></span>
                <span><small>Reserva</small><strong>${reais(reserva)}</strong></span>
            </div>
            ${dividas.length ? `<ul class="inicio-fin-dividas">${dividas.map(d => `
                <li><i class="fa-solid fa-people-arrows"></i> ${escaparHtml(nomeDoMorador(d.devedor))} deve <strong>${reais(d.valor)}</strong> a ${escaparHtml(nomeDoMorador(d.credor))}</li>`).join('')}
            </ul>` : ''}
        `;
    }
};
