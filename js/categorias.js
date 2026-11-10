window.iniciarCategorias = (raiz) => {
    const cadastro = iniciarCadastro({
        raiz,
        form: '#form-categoria', tabela: '#tabela-categorias', entidade: 'categoria_produto', id: 'categoriaprodutoid',
        colunas: 'categoriaprodutoid, ds_categoria_produto',
        celulas: [c => c.categoriaprodutoid, c => c.ds_categoria_produto],
        nome: c => `a categoria ${c.ds_categoria_produto}`,
        dados(form) {
            return { ds_categoria_produto: SCP.texto(form.querySelector('#descricao').value, 'a descrição da categoria') };
        },
        editar(form, categoria) {
            form.querySelector('#descricao').value = categoria.ds_categoria_produto ?? '';
            form.querySelector('#descricao').focus();
        }
    });

    return { ativar: cadastro.carregar };
};
