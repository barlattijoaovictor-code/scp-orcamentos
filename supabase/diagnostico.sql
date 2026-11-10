-- Somente leitura. Execute no SQL Editor para conferir o esquema real do projeto.
-- Nao retorna dados dos clientes nem altera tabelas, sequencias ou permissoes.

SELECT table_name, column_name, data_type, is_nullable, column_default,
       is_identity, identity_generation,
       pg_get_serial_sequence(format('%I.%I', table_schema, table_name), column_name) AS sequencia
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('cliente', 'categoria_produto', 'produto', 'orcamento', 'orcamento_item')
ORDER BY table_name, ordinal_position;

SELECT c.relname AS tabela, con.conname AS restricao,
       pg_get_constraintdef(con.oid) AS definicao
FROM pg_constraint con
JOIN pg_class c ON c.oid = con.conrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('cliente', 'categoria_produto', 'produto', 'orcamento', 'orcamento_item')
ORDER BY c.relname, con.conname;

SELECT tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('cliente', 'categoria_produto', 'produto', 'orcamento', 'orcamento_item')
ORDER BY tablename, policyname;

SELECT c.relname AS tabela, c.relrowsecurity AS rls_ativado,
       c.relforcerowsecurity AS rls_forcado
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('cliente', 'categoria_produto', 'produto', 'orcamento', 'orcamento_item');
