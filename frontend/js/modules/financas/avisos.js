import { api } from '../../core/api.js';
import { hoje } from '../../core/datas.js';
import { categoria } from '../../core/categorias.js';
import { ESCOPO, NEUTRAS, reais, somarMeses, nomeDoMorador } from './dados.js';

const DIAS_COBRANCA = 15;

// Avisos do sino: orçamento estourado (ou perto), banco com erro e divisões paradas há muito tempo
export default async function avisos() {
    const mes = hoje().slice(0, 7);
    const [transacoes, orcamentos, conexoes, divisoes] = await Promise.all([
        api(`/financas/transacoes?de=${mes}-01&ate=${somarMeses(mes, 1)}-01`),
        api('/financas/orcamentos'),
        api('/financas/conexoes'),
        api('/financas/divisoes')
    ]);
    const lista = [];

    const gastos = new Map();
    transacoes.filter(t => !t.ignorada && !NEUTRAS.includes(t.categoria) && t.valor < 0)
        .forEach(t => gastos.set(t.categoria, (gastos.get(t.categoria) || 0) - t.valor));
    orcamentos.forEach(o => {
        const pct = (gastos.get(o.categoria) || 0) / o.valorMensal;
        const nome = categoria(ESCOPO, o.categoria).nome;
        if (pct >= 1) lista.push({ id: `fin:orcamento:${o.categoria}:${mes}:100`, tipo: 'alerta', icone: 'fa-solid fa-bullseye', texto: `Orçamento de ${nome} estourado (${reais(gastos.get(o.categoria))} de ${reais(o.valorMensal)})`, rota: 'financas/visao' });
        else if (pct >= 0.8) lista.push({ id: `fin:orcamento:${o.categoria}:${mes}:80`, icone: 'fa-solid fa-bullseye', texto: `${nome}: ${Math.round(pct * 100)}% do orçamento do mês já foi usado`, rota: 'financas/visao' });
    });

    conexoes.filter(c => c.status === 'erro').forEach(c => lista.push({
        id: `fin:conexao:${c.id}:${c.ultimaSincronizacao || ''}`, tipo: 'alerta', icone: 'fa-solid fa-building-columns',
        texto: `Falha ao atualizar ${c.instituicao || 'o banco'}: ${c.erro || 'tente sincronizar de novo'}`, rota: 'financas/contas'
    }));

    const limite = new Date(Date.now() - DIAS_COBRANCA * 86400000).toISOString().slice(0, 10);
    divisoes.filter(d => d.data <= limite && d.participantes.some(p => !p.pago)).forEach(d => lista.push({
        id: `fin:divisao:${d.id}:${d.participantes.filter(p => !p.pago).length}`, icone: 'fa-solid fa-people-arrows',
        texto: `"${d.descricao}" tem partes em aberto há mais de ${DIAS_COBRANCA} dias (pago por ${nomeDoMorador(d.pagoPor)})`, rota: 'financas/divisoes'
    }));
    return lista;
}
