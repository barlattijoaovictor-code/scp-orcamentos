-- Execute este arquivo no SQL Editor do projeto Supabase.
-- Corrige a sequencia de orcamentoid sem alterar os registros existentes.
-- Referencia: https://www.postgresql.org/docs/current/functions-sequence.html

BEGIN;

-- Impede insercoes concorrentes durante a leitura e o ajuste.
LOCK TABLE public.orcamento IN ACCESS EXCLUSIVE MODE;

DO $$
DECLARE
    sequencia regclass;
    maior_id bigint;
BEGIN
    sequencia := pg_get_serial_sequence('public.orcamento', 'orcamentoid')::regclass;

    IF sequencia IS NULL THEN
        RAISE EXCEPTION 'orcamentoid nao possui sequencia associada. Verifique o DEFAULT, IDENTITY e os triggers da coluna antes de corrigir.';
    END IF;

    SELECT MAX(orcamentoid) INTO maior_id FROM public.orcamento;

    PERFORM setval(sequencia, GREATEST(COALESCE(maior_id, 1), 1), COALESCE(maior_id >= 1, false));
END;
$$;

COMMIT;
