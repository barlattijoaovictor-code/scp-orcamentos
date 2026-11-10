// Fluxo comum de listagem, edição, gravação e exclusão dos cadastros.
window.iniciarCadastro = (config) => {
    const form = config.raiz.querySelector(config.form);
    const tabela = config.raiz.querySelector(config.tabela);
    const codigo = form.querySelector('#codigo');
    const salvar = form.querySelector('#botao-salvar');
    const registros = new Map();
    let idEmEdicao = null;
    let consultaAtual = 0;

    function cancelarEdicao() {
        idEmEdicao = null;
        codigo.value = '';
        salvar.textContent = 'Salvar';
    }

    async function carregar() {
        const consulta = ++consultaAtual;
        SCP.mensagemTabela(tabela, config.celulas.length + 1, 'Carregando...');
        try {
            const dados = await SCP.listar(config.entidade, config.colunas, config.id);
            if (consulta !== consultaAtual) return;
            registros.clear();
            tabela.replaceChildren();
            if (!dados.length) {
                SCP.mensagemTabela(tabela, config.celulas.length + 1, 'Nenhum registro cadastrado.');
                return;
            }
            const fragmento = document.createDocumentFragment();
            dados.forEach((registro) => {
                registros.set(String(registro[config.id]), registro);
                const linha = document.createElement('tr');
                config.celulas.forEach((valor) => SCP.criarCelula(linha, valor(registro)));
                const acoes = SCP.criarCelula(linha, '');
                ['editar', 'excluir'].forEach((acao) => {
                    const botao = document.createElement('button');
                    botao.type = 'button';
                    botao.textContent = acao === 'editar' ? 'Editar' : 'Excluir';
                    botao.dataset.action = acao;
                    botao.dataset.id = registro[config.id];
                    acoes.appendChild(botao);
                });
                fragmento.appendChild(linha);
            });
            tabela.appendChild(fragmento);
        } catch (erro) {
            if (consulta !== consultaAtual) return;
            console.error(erro);
            SCP.mensagemTabela(tabela, config.celulas.length + 1, `Erro ao carregar. ${SCP.mensagemErro(erro)}`);
        }
    }

    form.addEventListener('reset', () => {
        cancelarEdicao();
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (SCP.ocupado(form) || (config.podeOperar && !config.podeOperar()) || !form.reportValidity()) return;
        let dados;
        try { dados = config.dados(form); } catch (erro) { SCP.mostrarErro(erro); return; }
        await SCP.executar([form, tabela], async () => {
            if (idEmEdicao !== null) {
                const alterados = await SCP.consultar(window.supabaseClient.from(config.entidade)
                    .update(dados).eq(config.id, idEmEdicao).select(config.id));
                if (!alterados?.length) throw new Error('O registro não foi atualizado. Ele pode ter sido removido ou seu acesso foi negado.');
            } else if (config.inserir) {
                await config.inserir(dados);
            } else {
                await SCP.consultar(window.supabaseClient.from(config.entidade)
                    .insert([config.prepararNovo ? config.prepararNovo(dados) : dados]));
            }
            form.reset();
            await carregar();
        });
    });

    tabela.addEventListener('click', async (event) => {
        const botao = event.target.closest('button[data-action]');
        if (!botao || SCP.ocupado(form) || (config.podeOperar && !config.podeOperar())) return;
        const registro = registros.get(botao.dataset.id);
        if (!registro) return;
        if (botao.dataset.action === 'editar') {
            config.editar(form, registro);
            idEmEdicao = registro[config.id];
            codigo.value = idEmEdicao;
            salvar.textContent = 'Atualizar';
            return;
        }
        if (!window.confirm(`Excluir ${config.nome(registro)}?`)) return;
        await SCP.executar([form, tabela], async () => {
            const removidos = await SCP.consultar(window.supabaseClient.from(config.entidade)
                .delete().eq(config.id, registro[config.id]).select(config.id));
            if (!removidos?.length) throw new Error('O registro não foi excluído. Ele pode ter sido removido ou seu acesso foi negado.');
            if (String(idEmEdicao) === String(registro[config.id])) form.reset();
            await carregar();
        });
    });

    cancelarEdicao();
    carregar();
    return { carregar: () => { if (!SCP.ocupado(form)) return carregar(); } };
};
