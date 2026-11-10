// Funções compartilhadas pelas telas de cadastro e orçamento.
window.SCP = (() => {
    const ocupados = new WeakSet();
    const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

    async function consultar(consulta) {
        const { data, error } = await consulta;
        if (error) throw error;
        return data;
    }

    async function listar(tabela, colunas, ordem) {
        const registros = [];
        const tamanhoPagina = 500;
        for (let inicio = 0; ; inicio += tamanhoPagina) {
            const pagina = await consultar(window.supabaseClient.from(tabela)
                .select(colunas).order(ordem, { ascending: true })
                .range(inicio, inicio + tamanhoPagina - 1));
            registros.push(...(pagina || []));
            if (!pagina || pagina.length < tamanhoPagina) return registros;
        }
    }

    function mensagemErro(erro) {
        if (erro.code === '23503') return 'O registro está vinculado a outros dados ou a referência selecionada não existe mais. Atualize a lista e confira os vínculos.';
        if (erro.code === '23505') return 'Já existe um registro com esses dados ou código. Confira o cadastro e a numeração automática do banco.';
        if (erro.code === '42501' || erro.status === 401 || erro.status === 403) return 'Acesso negado pelo banco. Confira a autenticação e as permissões do projeto.';
        return erro.message || 'Não foi possível concluir a operação. Verifique a conexão e tente novamente.';
    }

    function mostrarErro(erro) {
        console.error(erro);
        window.alert(mensagemErro(erro));
    }

    // Bloqueia campos, edição e exclusão enquanto uma gravação está em andamento.
    async function executar(alvos, operacao) {
        if (alvos.some((alvo) => ocupados.has(alvo))) return;
        const controles = alvos.flatMap((alvo) => [...alvo.querySelectorAll('input, select, textarea, button')]);
        const estados = controles.map((controle) => controle.disabled);
        alvos.forEach((alvo) => ocupados.add(alvo));
        controles.forEach((controle) => { controle.disabled = true; });
        try {
            await operacao();
        } catch (erro) {
            mostrarErro(erro);
        } finally {
            controles.forEach((controle, indice) => { controle.disabled = estados[indice]; });
            alvos.forEach((alvo) => ocupados.delete(alvo));
        }
    }

    function criarCelula(linha, texto) {
        const celula = document.createElement('td');
        celula.textContent = texto ?? '';
        linha.appendChild(celula);
        return celula;
    }

    function mensagemTabela(tabela, colunas, mensagem) {
        const linha = document.createElement('tr');
        const celula = criarCelula(linha, mensagem);
        celula.colSpan = colunas;
        celula.className = 'mensagem-tabela';
        tabela.replaceChildren(linha);
    }

    function numero(valor, nome, minimo = 0) {
        const resultado = Number(valor);
        if (String(valor).trim() === '' || !Number.isFinite(resultado) || resultado < minimo) {
            throw new Error(`${nome}: informe um número válido, maior ou igual a ${minimo}.`);
        }
        return resultado;
    }

    function texto(valor, nome) {
        const resultado = valor.trim();
        if (!resultado) throw new Error(`Preencha ${nome}.`);
        return resultado;
    }

    function centavos(valor) {
        const resultado = Math.round((numero(valor, 'Valor') + Number.EPSILON) * 100);
        if (!Number.isSafeInteger(resultado)) throw new Error('Valor acima do limite permitido.');
        return resultado;
    }

    async function preencherSelect(campo, tabela, id, descricao, mensagem, colunas = `${id}, ${descricao}`) {
        const selecionado = campo.value;
        campo.disabled = true;
        campo.replaceChildren(new Option('Carregando...', ''));
        try {
            const registros = await listar(tabela, colunas, id);
            registros.sort((a, b) => String(a[descricao] || '').localeCompare(String(b[descricao] || ''), 'pt-BR'));
            campo.replaceChildren(new Option(registros.length ? mensagem : 'Nenhum cadastro disponível', '', true, true));
            registros.forEach((registro) => campo.add(new Option(
                `${registro[descricao] || 'Sem descrição'} (Código: ${registro[id]})`, String(registro[id])
            )));
            if (registros.some((registro) => String(registro[id]) === selecionado)) campo.value = selecionado;
            campo.disabled = registros.length === 0;
            return registros;
        } catch (erro) {
            campo.replaceChildren(new Option('Erro ao carregar. Atualize a lista.', ''));
            throw erro;
        }
    }

    return { consultar, listar, mensagemErro, mostrarErro, executar, criarCelula, mensagemTabela,
        numero, texto, centavos, preencherSelect, moeda: (valor) => moeda.format(Number(valor || 0)),
        ocupado: (alvo) => ocupados.has(alvo) };
})();
