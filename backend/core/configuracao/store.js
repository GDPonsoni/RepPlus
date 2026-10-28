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

const configFromDb = (row) => ({
  logo: row.logo,
  background: row.background,
  motivacaoDestaque: row.motivacao_destaque,
  cores: { ...DEFAULT_CORES, ...(row.cores || {}) }
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
      cores: { ...DEFAULT_CORES, ...(config.cores || {}) }
    }).eq('id', 1).select().single());
    return configFromDb(row);
  }
};
