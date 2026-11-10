window.iniciarProdutos = (raiz) => {
    const categoriaInput = raiz.querySelector('#categoriaprodutoid');
    const botaoAtualizarCategorias = raiz.querySelector('#btn-atualizar-categorias');
    const statusCategorias = raiz.querySelector('#status-categorias');
    let categoriasCarregando = false;

    async function carregarCategorias() {
        if (SCP.ocupado(raiz.querySelector('#form-produto'))) return;
        if (categoriasCarregando) return;
        categoriasCarregando = true;
        botaoAtualizarCategorias.disabled = true;
        statusCategorias.textContent = 'Carregando categorias...';
        try {
            const categorias = await SCP.preencherSelect(categoriaInput, 'categoria_produto',
                'categoriaprodutoid', 'ds_categoria_produto', 'Selecione uma categoria');
            statusCategorias.textContent = categorias.length ? '' : 'Cadastre uma categoria e atualize a lista.';
        } catch (erro) {
            console.error(erro);
            statusCategorias.textContent = SCP.mensagemErro(erro);
        } finally {
            categoriasCarregando = false;
            botaoAtualizarCategorias.disabled = false;
        }
    }

    botaoAtualizarCategorias.addEventListener('click', carregarCategorias);

    const cadastro = iniciarCadastro({
        raiz,
        form: '#form-produto', tabela: '#tabela-produtos', entidade: 'produto', id: 'produtoid',
        colunas: 'produtoid, categoriaprodutoid, ds_produto, obs_produto, vl_venda_produto, status_produto',
        podeOperar: () => !categoriasCarregando,
        celulas: [p => p.produtoid, p => p.categoriaprodutoid, p => p.ds_produto,
            p => SCP.moeda(p.vl_venda_produto), p => p.status_produto],
        nome: p => `o produto ${p.ds_produto}`,
        dados(form) {
            if (categoriaInput.disabled || !categoriaInput.value) throw new Error('Selecione uma categoria cadastrada.');
            return {
                categoriaprodutoid: categoriaInput.value,
                ds_produto: SCP.texto(form.querySelector('#dsproduto').value, 'a descrição do produto'),
                obs_produto: form.querySelector('#obsproduto').value.trim(),
                vl_venda_produto: SCP.centavos(form.querySelector('#vl_venda_produto').value) / 100,
                status_produto: SCP.texto(form.querySelector('#status_produto').value, 'o status do produto')
            };
        },
        prepararNovo: dados => ({ ...dados, dt_cadastro_produto: new Date().toISOString() }),
        editar(form, produto) {
            categoriaInput.value = String(produto.categoriaprodutoid);
            form.querySelector('#dsproduto').value = produto.ds_produto ?? '';
            form.querySelector('#obsproduto').value = produto.obs_produto ?? '';
            form.querySelector('#vl_venda_produto').value = produto.vl_venda_produto ?? '';
            form.querySelector('#status_produto').value = produto.status_produto ?? '';
            form.querySelector('#dsproduto').focus();
        }
    });

    carregarCategorias();

    return { ativar() { carregarCategorias(); cadastro.carregar(); } };
};
