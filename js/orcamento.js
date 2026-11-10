window.iniciarOrcamentos = (raiz) => {
    const formOrcamento = raiz.querySelector('#form-orcamento');
    const tabelaOrcamentos = raiz.querySelector('#tabela-orcamentos');
    const clienteInput = raiz.querySelector('#clienteid');
    const dataInput = raiz.querySelector('#dt_orcamento');
    function preencherDataAtual() {
        const agora = new Date();
        const doisDigitos = valor => String(valor).padStart(2, '0');
        dataInput.value = `${agora.getFullYear()}-${doisDigitos(agora.getMonth() + 1)}-${doisDigitos(agora.getDate())}T${doisDigitos(agora.getHours())}:${doisDigitos(agora.getMinutes())}`;
    }
    const validadeInput = raiz.querySelector('#dt_validade_orcamento');
    const totalInput = raiz.querySelector('#vl_total_orcamento');
    const botaoSalvar = raiz.querySelector('#botao-salvar');
    const statusClientes = raiz.querySelector('#status-clientes');
    const botaoAtualizarClientes = raiz.querySelector('#btn-atualizar-clientes');
    const itemProdutoInput = raiz.querySelector('#item_produtoid');
    const itemQtInput = raiz.querySelector('#item_qt_produto');
    const itemValorInput = raiz.querySelector('#item_vl_unitario');
    const botaoAdicionar = raiz.querySelector('#btn-add-item');
    const botaoAtualizarProdutos = raiz.querySelector('#btn-atualizar-produtos');
    const statusProdutos = raiz.querySelector('#status-produtos');
    const statusOrcamento = raiz.querySelector('#status-orcamento');
    const tabelaItens = raiz.querySelector('#tabela-itens-temporarios');
    const visualizacao = raiz.querySelector('#visualizacao-orcamento');
    const documento = raiz.querySelector('#documento-orcamento');
    const statusDocumento = raiz.querySelector('#status-documento');
    const botaoImprimir = raiz.querySelector('#imprimir-orcamento');
    let consultaDocumento = 0;

    async function carregarItensSalvos(id) {
        const itens = [];
        for (let inicio = 0; ; inicio += 500) {
            const pagina = await SCP.consultar(window.supabaseClient.from('orcamento_item')
                .select('orcamentoitemid, produtoid, qt_produto, vl_unitario, vl_total')
                .eq('orcamentoid', id).order('orcamentoitemid', { ascending: true }).range(inicio, inicio + 499));
            itens.push(...(pagina || []));
            if (!pagina || pagina.length < 500) return itens;
        }
    }

    async function visualizarOrcamento(id) {
        if (!raiz.isConnected) return;
        const consulta = ++consultaDocumento;
        documento.hidden = true;
        botaoImprimir.disabled = true;
        statusDocumento.textContent = 'Carregando documento...';
        if (!visualizacao.open) visualizacao.showModal();
        try {
            const [orcamento, itens, catalogo] = await Promise.all([
                SCP.consultar(window.supabaseClient.from('orcamento')
                    .select('orcamentoid, clienteid, dt_orcamento, dt_validade_orcamento, vl_total_orcamento')
                    .eq('orcamentoid', id).single()),
                carregarItensSalvos(id),
                SCP.listar('produto', 'produtoid, ds_produto', 'produtoid')
            ]);
            if (!orcamento) throw new Error('Orçamento não encontrado ou indisponível para consulta.');
            const clientes = await SCP.consultar(window.supabaseClient.from('cliente')
                .select('clienteid, nome_cliente, cpf_cnpj_cliente').eq('clienteid', orcamento.clienteid).limit(1));
            if (consulta !== consultaDocumento || !visualizacao.open) return;
            const cliente = clientes?.[0];
            const nomes = new Map(catalogo.map(produto => [String(produto.produtoid), produto.ds_produto]));
            const data = valor => valor ? new Date(valor).toLocaleString('pt-BR') : 'Não informada';
            const campos = {
                codigo: `Nº ${orcamento.orcamentoid}`,
                cliente: cliente?.nome_cliente || `Cliente #${orcamento.clienteid} — cadastro indisponível`,
                cpf: cliente?.cpf_cnpj_cliente || 'Não informado',
                data: data(orcamento.dt_orcamento), validade: data(orcamento.dt_validade_orcamento),
                total: SCP.moeda(orcamento.vl_total_orcamento)
            };
            Object.entries(campos).forEach(([campo, valor]) => {
                documento.querySelector(`[data-documento="${campo}"]`).textContent = valor;
            });
            const tabela = raiz.querySelector('#itens-documento');
            tabela.replaceChildren();
            itens.forEach(item => {
                const linha = document.createElement('tr');
                SCP.criarCelula(linha, nomes.get(String(item.produtoid)) || `Produto #${item.produtoid} — cadastro indisponível`);
                SCP.criarCelula(linha, item.qt_produto);
                SCP.criarCelula(linha, SCP.moeda(item.vl_unitario));
                SCP.criarCelula(linha, SCP.moeda(item.vl_total));
                tabela.appendChild(linha);
            });
            if (!itens.length) SCP.mensagemTabela(tabela, 4, 'Nenhum item salvo neste orçamento.');
            documento.hidden = false;
            botaoImprimir.disabled = false;
            statusDocumento.textContent = '';
        } catch (erro) {
            if (consulta !== consultaDocumento || !visualizacao.open) return;
            console.error(erro);
            statusDocumento.textContent = `Não foi possível abrir o documento. ${SCP.mensagemErro(erro)} Feche e clique em Visualizar para tentar novamente.`;
        }
    }

    raiz.querySelector('#fechar-orcamento').addEventListener('click', () => visualizacao.close());
    visualizacao.addEventListener('close', () => { consultaDocumento++; });
    botaoImprimir.addEventListener('click', () => {
        if (documento.hidden || botaoImprimir.disabled) return;
        const copia = documento.cloneNode(true);
        copia.removeAttribute('id');
        copia.querySelectorAll('[id]').forEach(elemento => elemento.removeAttribute('id'));
        copia.classList.add('copia-orcamento');
        const tituloAnterior = document.title;
        document.title = `Orçamento ${documento.querySelector('[data-documento="codigo"]').textContent} - SCP`;
        document.body.appendChild(copia);
        document.body.classList.add('imprimindo-orcamento');
        try { window.print(); }
        finally {
            copia.remove();
            document.body.classList.remove('imprimindo-orcamento');
            document.title = tituloAnterior;
        }
    });

    let itensCarrinho = [];
    let produtos = new Map();
    let clientesDisponiveis = false;
    let gravacaoIncerta = false;
    let clientesCarregando = false;
    let produtosCarregando = false;

    function atualizarBotaoSalvar() {
        botaoSalvar.disabled = !clientesDisponiveis || clientesCarregando || produtosCarregando || gravacaoIncerta;
    }

    async function carregarClientes() {
        if (SCP.ocupado(formOrcamento) || clientesCarregando) return;
        clientesCarregando = true;
        clientesDisponiveis = false;
        botaoSalvar.disabled = true;
        botaoAtualizarClientes.disabled = true;
        statusClientes.textContent = 'Carregando clientes...';
        try {
            const clientes = await SCP.preencherSelect(clienteInput, 'cliente', 'clienteid', 'nome_cliente', 'Selecione um cliente');
            clientesDisponiveis = clientes.length > 0;
            statusClientes.textContent = clientesDisponiveis ? '' : 'Cadastre um cliente e atualize a lista.';
        } catch (erro) {
            console.error(erro);
            statusClientes.textContent = SCP.mensagemErro(erro);
        } finally {
            clientesCarregando = false;
            botaoAtualizarClientes.disabled = false;
            atualizarBotaoSalvar();
        }
    }

    async function carregarProdutos() {
        if (SCP.ocupado(formOrcamento) || produtosCarregando) return;
        produtosCarregando = true;
        atualizarBotaoSalvar();
        botaoAtualizarProdutos.disabled = true;
        botaoAdicionar.disabled = true;
        statusProdutos.textContent = 'Carregando produtos...';
        try {
            const dados = await SCP.preencherSelect(itemProdutoInput, 'produto', 'produtoid', 'ds_produto',
                'Selecione um produto', 'produtoid, ds_produto, vl_venda_produto');
            produtos = new Map(dados.map(produto => [String(produto.produtoid), produto]));
            statusProdutos.textContent = produtos.size ? '' : 'Cadastre um produto e atualize a lista.';
        } catch (erro) {
            produtos.clear();
            console.error(erro);
            statusProdutos.textContent = SCP.mensagemErro(erro);
        } finally {
            produtosCarregando = false;
            botaoAtualizarProdutos.disabled = false;
            botaoAdicionar.disabled = produtos.size === 0;
            atualizarBotaoSalvar();
        }
    }

    async function carregarOrcamentos() {
        SCP.mensagemTabela(tabelaOrcamentos, 6, 'Carregando orçamentos...');
        try {
            const dados = await SCP.listar('orcamento',
                'orcamentoid, clienteid, dt_orcamento, dt_validade_orcamento, vl_total_orcamento', 'orcamentoid');
            tabelaOrcamentos.replaceChildren();
            if (!dados.length) {
                SCP.mensagemTabela(tabelaOrcamentos, 6, 'Nenhum orçamento cadastrado.');
                return;
            }
            const fragmento = document.createDocumentFragment();
            dados.forEach(orcamento => {
                const linha = document.createElement('tr');
                SCP.criarCelula(linha, orcamento.orcamentoid);
                SCP.criarCelula(linha, orcamento.clienteid);
                SCP.criarCelula(linha, orcamento.dt_orcamento ? new Date(orcamento.dt_orcamento).toLocaleString('pt-BR') : '');
                SCP.criarCelula(linha, orcamento.dt_validade_orcamento ? new Date(orcamento.dt_validade_orcamento).toLocaleString('pt-BR') : '');
                SCP.criarCelula(linha, SCP.moeda(orcamento.vl_total_orcamento));
                const acoes = SCP.criarCelula(linha, '');
                const visualizar = document.createElement('button');
                visualizar.type = 'button';
                visualizar.textContent = 'Visualizar';
                visualizar.dataset.id = orcamento.orcamentoid;
                visualizar.dataset.acao = 'visualizar';
                visualizar.setAttribute('aria-label', `Visualizar orçamento ${orcamento.orcamentoid}`);
                acoes.appendChild(visualizar);
                const excluir = document.createElement('button');
                excluir.type = 'button';
                excluir.textContent = 'Excluir';
                excluir.dataset.id = orcamento.orcamentoid;
                excluir.dataset.acao = 'excluir';
                acoes.appendChild(excluir);
                fragmento.appendChild(linha);
            });
            tabelaOrcamentos.appendChild(fragmento);
        } catch (erro) {
            console.error(erro);
            SCP.mensagemTabela(tabelaOrcamentos, 6, `Erro ao carregar. ${SCP.mensagemErro(erro)}`);
        }
    }

    function totalCentavos() {
        const total = itensCarrinho.reduce((soma, item) => soma + item.totalCentavos, 0);
        if (!Number.isSafeInteger(total)) throw new Error('Total acima do limite permitido.');
        return total;
    }

    function renderizarItens() {
        tabelaItens.replaceChildren();
        totalInput.value = (totalCentavos() / 100).toFixed(2);
        if (!itensCarrinho.length) {
            SCP.mensagemTabela(tabelaItens, 5, 'Nenhum item adicionado ainda.');
            return;
        }
        itensCarrinho.forEach((item, indice) => {
            const linha = document.createElement('tr');
            SCP.criarCelula(linha, item.nome);
            SCP.criarCelula(linha, item.qt_produto);
            SCP.criarCelula(linha, SCP.moeda(item.vl_unitario));
            SCP.criarCelula(linha, SCP.moeda(item.totalCentavos / 100));
            const acoes = SCP.criarCelula(linha, '');
            const remover = document.createElement('button');
            remover.type = 'button';
            remover.textContent = 'Remover';
            remover.dataset.indice = indice;
            acoes.appendChild(remover);
            tabelaItens.appendChild(linha);
        });
    }

    botaoAtualizarClientes.addEventListener('click', carregarClientes);
    botaoAtualizarProdutos.addEventListener('click', carregarProdutos);
    itemProdutoInput.addEventListener('change', () => {
        const valor = produtos.get(itemProdutoInput.value)?.vl_venda_produto;
        itemValorInput.value = valor != null && String(valor).trim() !== ''
            && Number.isFinite(Number(valor)) && Number(valor) >= 0
            ? Number(valor).toFixed(2) : '';
    });

    botaoAdicionar.addEventListener('click', () => {
        if (SCP.ocupado(formOrcamento)) return;
        try {
            const produto = produtos.get(itemProdutoInput.value);
            if (!produto || itemProdutoInput.disabled) throw new Error('Selecione um produto cadastrado.');
            if (!itemQtInput.reportValidity() || !itemValorInput.reportValidity()) return;
            const quantidade = SCP.numero(itemQtInput.value, 'Quantidade', 1);
            if (!Number.isSafeInteger(quantidade)) throw new Error('Informe uma quantidade inteira válida.');
            const valorCentavos = SCP.centavos(itemValorInput.value);
            const totalItem = Math.round(quantidade * valorCentavos);
            if (!Number.isSafeInteger(totalItem) || !Number.isSafeInteger(totalCentavos() + totalItem)) {
                throw new Error('Total acima do limite permitido.');
            }
            itensCarrinho.push({
                produtoid: produto.produtoid, nome: produto.ds_produto, qt_produto: quantidade,
                vl_unitario: valorCentavos / 100, totalCentavos: totalItem
            });
            renderizarItens();
            itemProdutoInput.value = '';
            itemQtInput.value = '';
            itemValorInput.value = '';
            itemProdutoInput.focus();
        } catch (erro) { SCP.mostrarErro(erro); }
    });

    tabelaItens.addEventListener('click', (event) => {
        const botao = event.target.closest('button[data-indice]');
        if (!botao || SCP.ocupado(formOrcamento)) return;
        itensCarrinho.splice(Number(botao.dataset.indice), 1);
        renderizarItens();
    });

    formOrcamento.addEventListener('reset', () => {
        itensCarrinho = [];
        // O reset nativo dos campos ocorre depois do evento.
        queueMicrotask(() => {
            renderizarItens();
            preencherDataAtual();
        });
        if (!gravacaoIncerta) statusOrcamento.textContent = '';
    });

    formOrcamento.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (SCP.ocupado(formOrcamento) || clientesCarregando || produtosCarregando || gravacaoIncerta || !formOrcamento.reportValidity()) return;
        let cabecalho;
        let itens;
        try {
            if (!clientesDisponiveis || !clienteInput.value) throw new Error('Selecione um cliente cadastrado.');
            if (!itensCarrinho.length) throw new Error('Adicione pelo menos um item ao orçamento.');
            const data = new Date(dataInput.value);
            const validade = new Date(validadeInput.value);
            if (!Number.isFinite(data.getTime()) || !Number.isFinite(validade.getTime())) throw new Error('Informe datas válidas.');
            if (validade < data) throw new Error('A validade não pode ser anterior à data do orçamento.');
            cabecalho = { clienteid: clienteInput.value, dt_orcamento: data.toISOString(),
                dt_validade_orcamento: validade.toISOString(), vl_total_orcamento: totalCentavos() / 100 };
            // A chave do item é (orcamentoid, orcamentoitemid): numeração local ao novo orçamento.
            itens = itensCarrinho.map((item, indice) => ({ orcamentoitemid: indice + 1,
                produtoid: item.produtoid, qt_produto: item.qt_produto,
                vl_unitario: item.vl_unitario, vl_total: item.totalCentavos / 100 }));
        } catch (erro) { SCP.mostrarErro(erro); return; }

        await SCP.executar([formOrcamento, tabelaOrcamentos], async () => {
            statusOrcamento.textContent = 'Salvando orçamento...';
            let criado;
            try {
                criado = await SCP.consultar(window.supabaseClient.from('orcamento')
                    .insert([cabecalho]).select('orcamentoid').single());
            } catch (erro) {
                if (!/^[0-9A-Z]{5}$/.test(erro.code || '')) gravacaoIncerta = true;
                statusOrcamento.textContent = gravacaoIncerta
                    ? 'Não foi possível confirmar a gravação. Confira os orçamentos no banco antes de recarregar e tentar novamente.'
                    : SCP.mensagemErro(erro);
                throw erro;
            }

            try {
                await SCP.consultar(window.supabaseClient.from('orcamento_item')
                    .insert(itens.map(item => ({ ...item, orcamentoid: criado.orcamentoid }))));
            } catch (erro) {
                // Só desfaz o cabeçalho quando o banco confirmou que o INSERT dos itens falhou.
                // Falha de rede pode ocorrer depois da gravação: nesse caso não se apaga nem repete.
                if (/^[0-9A-Z]{5}$/.test(erro.code || '')) {
                    try {
                        const removidos = await SCP.consultar(window.supabaseClient.from('orcamento')
                            .delete().eq('orcamentoid', criado.orcamentoid).select('orcamentoid'));
                        if (!removidos?.length) throw new Error('Cabeçalho não removido.');
                        statusOrcamento.textContent = 'Os itens não foram salvos. O cabeçalho foi desfeito; confira os dados e tente novamente.';
                    } catch (erroLimpeza) {
                        console.error(erroLimpeza);
                        gravacaoIncerta = true;
                    }
                } else {
                    gravacaoIncerta = true;
                }
                if (gravacaoIncerta) statusOrcamento.textContent =
                    `Confira o orçamento ${criado.orcamentoid} no banco antes de recarregar e tentar novamente. A gravação dos itens não foi confirmada.`;
                await carregarOrcamentos();
                throw erro;
            }
            formOrcamento.reset();
            statusOrcamento.textContent = 'Orçamento salvo com sucesso!';
            await carregarOrcamentos();
            await visualizarOrcamento(criado.orcamentoid);
        });
        atualizarBotaoSalvar();
    });

    tabelaOrcamentos.addEventListener('click', async (event) => {
        const botao = event.target.closest('button[data-id]');
        if (!botao || SCP.ocupado(formOrcamento) || clientesCarregando || produtosCarregando) return;
        const id = botao.dataset.id;
        if (botao.dataset.acao === 'visualizar') {
            await visualizarOrcamento(id);
            return;
        }
        if (!window.confirm(`Excluir o orçamento ${id} e seus itens?`)) return;
        await SCP.executar([formOrcamento, tabelaOrcamentos], async () => {
            await SCP.consultar(window.supabaseClient.from('orcamento_item').delete().eq('orcamentoid', id));
            try {
                const removidos = await SCP.consultar(window.supabaseClient.from('orcamento')
                    .delete().eq('orcamentoid', id).select('orcamentoid'));
                if (!removidos?.length) throw new Error('O orçamento não foi excluído. Confira as permissões e atualize a página.');
            } catch (erro) {
                statusOrcamento.textContent = `A exclusão do orçamento ${id} não foi confirmada. Os itens podem ter sido removidos; confira o registro antes de continuar.`;
                throw erro;
            }
            statusOrcamento.textContent = 'Orçamento excluído.';
            await carregarOrcamentos();
        });
    });

    preencherDataAtual();
    renderizarItens();
    carregarClientes();
    carregarProdutos();
    carregarOrcamentos();

    return { ativar() { carregarClientes(); carregarProdutos(); if (!SCP.ocupado(formOrcamento)) carregarOrcamentos(); } };
};
