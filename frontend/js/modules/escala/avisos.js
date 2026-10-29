import { api } from '../../core/api.js';
import { hoje, inicioDaSemana } from '../../core/datas.js';

// Aviso do sino: a escala desta semana ainda não foi gerada
export default async function avisos() {
    const escalas = await api('/escala/atual');
    if (escalas.length) return [];
    return [{ id: `escala:sem-escala:${inicioDaSemana(hoje())}`, tipo: 'alerta', icone: 'fa-solid fa-broom', texto: 'A escala desta semana ainda não foi gerada', rota: 'escala/atual' }];
}
