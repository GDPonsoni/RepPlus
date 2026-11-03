-- Subcategorias: uma categoria pode ficar dentro de outra do mesmo grupo (um nível só).
-- `pai` guarda a chave da categoria principal; null = categoria principal.
-- Pode ser executado mais de uma vez sem efeito colateral.
alter table categorias add column if not exists pai text;

-- Finanças (só se o grupo já existe; numa instalação nova as padrão já vêm com subcategorias)
do $$
begin
  if exists (select 1 from categorias where escopo = 'financas') then
    -- Nova categoria principal: Serviços
    insert into categorias (escopo, chave, nome, cor, icone, ordem)
    values ('financas', 'servicos', 'Serviços', '#9333ea', 'fa-solid fa-user-gear', 6)
    on conflict (escopo, chave) do nothing;

    -- As que já existiam passam para dentro de uma principal (o nome padrão fica mais curto)
    update categorias set pai = 'mercado', nome = case when nome = 'Limpeza e utilidades' then 'Limpeza' else nome end
      where escopo = 'financas' and chave = 'limpeza' and pai is null
        and exists (select 1 from categorias where escopo = 'financas' and chave = 'mercado');
    update categorias set pai = 'servicos'
      where escopo = 'financas' and chave = 'assinaturas' and pai is null;

    -- Subcategorias novas, só onde a principal existe
    insert into categorias (escopo, chave, nome, cor, icone, ordem, pai)
    select 'financas', s.chave, s.nome, s.cor, s.icone, s.ordem, s.pai
    from (values
      ('comida', 'Comida', '#ea580c', 'fa-solid fa-apple-whole', 0, 'mercado'),
      ('higiene', 'Higiene', '#0d9488', 'fa-solid fa-pump-soap', 2, 'mercado'),
      ('bebidas', 'Bebidas', '#a16207', 'fa-solid fa-bottle-water', 3, 'mercado'),
      ('energia', 'Energia', '#eab308', 'fa-solid fa-lightbulb', 0, 'contas'),
      ('agua', 'Água', '#0891b2', 'fa-solid fa-faucet-drip', 1, 'contas'),
      ('gas', 'Gás', '#ea580c', 'fa-solid fa-fire-flame-simple', 2, 'contas'),
      ('internet', 'Internet e telefone', '#2563eb', 'fa-solid fa-wifi', 3, 'contas'),
      ('diarista', 'Diarista / empregada', '#db2777', 'fa-solid fa-broom', 1, 'servicos')
    ) as s(chave, nome, cor, icone, ordem, pai)
    where exists (select 1 from categorias c where c.escopo = 'financas' and c.chave = s.pai)
    on conflict (escopo, chave) do nothing;
    update categorias set ordem = 1 where escopo = 'financas' and chave = 'limpeza' and pai = 'mercado';
    update categorias set ordem = 0 where escopo = 'financas' and chave = 'assinaturas' and pai = 'servicos';

    -- Regras sugeridas que apontavam para "Contas da casa" passam para a subcategoria certa
    update fin_regras set categoria = 'energia' where categoria = 'contas' and termo in ('enel', 'cpfl', 'cemig', 'light s', 'energisa');
    update fin_regras set categoria = 'agua' where categoria = 'contas' and termo in ('sabesp', 'sanasa', 'brk ambiental', 'sanepar', 'copasa');
    update fin_regras set categoria = 'gas' where categoria = 'contas' and termo in ('comgas');
    update fin_regras set categoria = 'internet' where categoria = 'contas' and termo in ('vivo', 'claro', 'tim ', 'oi fibra', 'telefonica');
  end if;
end $$;
