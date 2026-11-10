// Cada seção é criada uma vez, preservando seus campos e eventos ao navegar.
(() => {
    const secoes = {
        inicio: { titulo: 'Início', descricao: 'Tudo o que você precisa para gerenciar seu negócio.' },
        clientes: { titulo: 'Clientes', descricao: 'Cadastre, consulte e atualize seus clientes.', iniciar: window.iniciarClientes },
        categorias: { titulo: 'Categorias', descricao: 'Organize as categorias dos seus produtos.', iniciar: window.iniciarCategorias },
        produtos: { titulo: 'Produtos', descricao: 'Mantenha seu catálogo e os valores de venda atualizados.', iniciar: window.iniciarProdutos },
        orcamentos: { titulo: 'Orçamentos', descricao: 'Prepare novos orçamentos e acompanhe os registros salvos.', iniciar: window.iniciarOrcamentos }
    };
    const paineis = new Map();
    const area = document.querySelector('#area-conteudo');
    const titulo = document.querySelector('#titulo-secao');
    const botaoMenu = document.querySelector('.alternar-menu');
    let secaoAtual;

    function fecharMenu() {
        document.body.classList.remove('menu-aberto');
        botaoMenu.setAttribute('aria-expanded', 'false');
    }

    function exibirSecao() {
        const destino = location.hash.slice(1) || 'inicio';
        if (destino === 'conteudo') return;
        const nome = Object.hasOwn(secoes, destino) ? destino : 'inicio';
        if (nome === secaoAtual) return;
        const secao = secoes[nome];
        const existente = paineis.has(nome);
        if (!existente) {
            const raiz = document.querySelector(`#tela-${nome}`).content.firstElementChild.cloneNode(true);
            paineis.set(nome, { raiz });
        }
        const painel = paineis.get(nome);
        // Só o painel ativo fica no documento, evitando IDs de formulários sobrepostos.
        area.replaceChildren(painel.raiz);
        if (!existente) painel.controle = secao.iniciar?.(painel.raiz);
        else painel.controle?.ativar();
        titulo.textContent = secao.titulo;
        document.querySelector('#descricao-secao').textContent = secao.descricao;
        document.title = `SCP - ${secao.titulo}`;
        document.querySelectorAll('[data-secao]').forEach(link => {
            if (link.dataset.secao === nome) link.setAttribute('aria-current', 'page');
            else link.removeAttribute('aria-current');
        });
        fecharMenu();
        if (secaoAtual !== undefined) {
            titulo.focus({ preventScroll: true });
            window.scrollTo(0, 0);
        }
        secaoAtual = nome;
    }

    botaoMenu.addEventListener('click', () => {
        const aberto = document.body.classList.toggle('menu-aberto');
        botaoMenu.setAttribute('aria-expanded', String(aberto));
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && document.body.classList.contains('menu-aberto')) {
            fecharMenu();
            botaoMenu.focus();
        }
    });
    document.querySelector('nav').addEventListener('click', event => {
        if (event.target.closest('[data-secao]')) fecharMenu();
    });
    window.addEventListener('hashchange', exibirSecao);
    exibirSecao();
})();
