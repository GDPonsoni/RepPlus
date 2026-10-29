import { supabase } from '../db/supabaseClient.js';
import { check } from '../db/helpers.js';

// Configuração geral da república (linha única id=1 da tabela `config`)

// ===== CONFIG =====
const DEFAULT_CORES = {
  primaria: '#DC0000',
  secundaria: '#FFD700',
  branca: '#FFFFFF',
  preta: '#000000'
};

// Identidade e estilo da interface (coluna jsonb `personalizacao`). Os valores aceitos ficam
// em OPCOES_PERSONALIZACAO; o que não estiver salvo usa o padrão.
export const PERSONALIZACAO_PADRAO = {
  nome: 'República',
  slogan: 'Organização com responsabilidade! 🏠',
  fonte: 'inter',
  cantos: 'arredondado',
  cabecalho: 'solido',
  fundoVisibilidade: 14
};

export const OPCOES_PERSONALIZACAO = {
  fonte: ['inter', 'poppins', 'nunito', 'roboto-slab', 'sistema'],
  cantos: ['reto', 'suave', 'arredondado', 'redondo'],
  cabecalho: ['solido', 'degrade', 'escuro']
};

const configFromDb = (row) => ({
  logo: row.logo,
  background: row.background,
  motivacaoDestaque: row.motivacao_destaque,
  cores: { ...DEFAULT_CORES, ...(row.cores || {}) },
  personalizacao: { ...PERSONALIZACAO_PADRAO, ...(row.personalizacao || {}) },
  modulosDesativados: Array.isArray(row.modulos_desativados) ? row.modulos_desativados : []
});

export const ConfigStore = {
  async get() {
    const row = check(await supabase.from('config').select('*').eq('id', 1).single());
    return configFromDb(row);
  },
  async save(config) {
    const row = check(await supabase.from('config').update({
      logo: config.logo,
      background: config.background,
      motivacao_destaque: config.motivacaoDestaque,
      cores: { ...DEFAULT_CORES, ...(config.cores || {}) },
      personalizacao: { ...PERSONALIZACAO_PADRAO, ...(config.personalizacao || {}) },
      modulos_desativados: config.modulosDesativados || []
    }).eq('id', 1).select().single());
    return configFromDb(row);
  }
};
