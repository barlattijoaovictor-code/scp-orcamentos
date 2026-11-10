const results = [];
const pause = () => new Promise(resolve => setTimeout(resolve, 30));
function assert(value, message) { if (!value) throw new Error(message); }

function installMock() {
    const clone = value => JSON.parse(JSON.stringify(value));
    const primaryKeys = { cliente: 'clienteid', categoria_produto: 'categoriaprodutoid',
        produto: 'produtoid', orcamento: 'orcamentoid' };
    window.mock = {
        alerts: [], errors: [], calls: [], failures: [],
        data: {
            cliente: [{ clienteid: 7, nome_cliente: 'Cliente de teste', tipo_cliente: 'F', cpf_cnpj_cliente: 'documento' }],
            categoria_produto: [{ categoriaprodutoid: 3, ds_categoria_produto: 'Categoria de teste' }],
            produto: [{ produtoid: 9, categoriaprodutoid: 3, ds_produto: 'Produto de teste',
                obs_produto: null, vl_venda_produto: 0.1, status_produto: 'Ativo' }],
            orcamento: [], orcamento_item: []
        }
    };
    window.alert = message => mock.alerts.push(message);
    window.confirm = () => true;
    window.addEventListener('error', event => mock.errors.push(event.message));
    window.addEventListener('unhandledrejection', event => mock.errors.push(String(event.reason)));
    window.supabaseClient = {
        from(table) {
            const query = { table, op: 'select', filters: [], columns: '*', returning: false };
            const builder = {
                select(columns = '*') { query.columns = columns; query.returning = true; return this; },
                order(column, options) { query.order = column; query.ascending = options.ascending; return this; },
                range(start, end) { query.range = [start, end]; return this; },
                limit(limit) { query.limit = limit; return this; },
                insert(data) { query.op = 'insert'; query.values = clone(data); return this; },
                update(data) { query.op = 'update'; query.values = clone(data); return this; },
                delete() { query.op = 'delete'; return this; },
                eq(column, value) { query.filters.push([column, value]); return this; },
                single() { query.single = true; return this; },
                then(resolve, reject) {
                    return Promise.resolve().then(async () => {
                        if (mock.waitFor) await mock.waitFor(query);
                        mock.calls.push(clone(query));
                        const failureIndex = mock.failures.findIndex(f => f.table === table && f.op === query.op);
                        if (failureIndex >= 0) {
                            const failure = mock.failures.splice(failureIndex, 1)[0];
                            if (failure.effect) failure.effect();
                            if (failure.throw) throw new Error('Failed to fetch');
                            return { data: failure.data ?? null, error: failure.error ?? null };
                        }
                        let rows = mock.data[table];
                        const matches = row => query.filters.every(([key, value]) => String(row[key]) === String(value));
                        let selected = rows.filter(matches);
                        if (query.op === 'insert') {
                            selected = query.values.map(row => ({ ...row }));
                            const staged = [...rows];
                            for (const row of selected) {
                                const keys = table === 'orcamento_item'
                                    ? ['orcamentoid', 'orcamentoitemid'] : [primaryKeys[table]];
                                if (table === 'orcamento_item') {
                                    if (keys.some(key => row[key] == null)) {
                                        return { error: { code: '23502', message: 'null value in primary key of orcamento_item' }, data: null };
                                    }
                                } else if (row[keys[0]] == null) {
                                    row[keys[0]] = Math.max(0, ...staged.map(r => Number(r[keys[0]]))) + 1;
                                }
                                if (staged.some(r => keys.every(key => String(r[key]) === String(row[key])))) {
                                    return { error: { code: '23505', message: table + '_pkey' }, data: null };
                                }
                                staged.push(row);
                            }
                            rows.push(...selected);
                        } else if (query.op === 'update') {
                            selected.forEach(row => Object.assign(row, query.values));
                        } else if (query.op === 'delete') {
                            mock.data[table] = rows.filter(row => !matches(row));
                        }
                        selected = clone(selected);
                        if (query.order) selected.sort((a, b) => (Number(a[query.order]) - Number(b[query.order])) * (query.ascending ? 1 : -1));
                        if (query.range) selected = selected.slice(query.range[0], query.range[1] + 1);
                        if (query.limit) selected = selected.slice(0, query.limit);
                        if (query.columns !== '*') selected = selected.map(row => Object.fromEntries(query.columns.split(',').map(k => [k.trim(), row[k.trim()]])));
                        return { data: query.single ? selected[0] : (query.returning ? selected : null), error: null };
                    }).then(resolve, reject);
                }
            };
            return builder;
        }
    };
}

async function page(name, setup = '') {
    document.querySelectorAll('iframe').forEach(frame => { URL.revokeObjectURL(frame.src); frame.remove(); });
    const frame = document.createElement('iframe');
    const ready = new Promise(resolve => { frame.onload = resolve; });
    const bootstrap = '<scr' + 'ipt>(' + installMock.toString() + ')();' + setup + '</scr' + 'ipt>';
    const secao = ['clientes', 'categorias', 'produtos', 'orcamentos'].includes(name) ? name : null;
    frame.style.cssText = 'width:1280px;height:900px;border:0';
    frame.src = URL.createObjectURL(new Blob([pages[secao ? 'home' : name].replace('<head>', '<head>' + bootstrap)], { type: 'text/html' }));
    document.body.appendChild(frame);
    await ready;
    await pause();
    if (secao) {
        frame.contentWindow.document.querySelector(`[data-secao="${secao}"]`).click();
        await pause();
    }
    assert(frame.contentWindow.mock.errors.length === 0, frame.contentWindow.mock.errors.join('; '));
    return frame.contentWindow;
}

function field(win, id, value) { win.document.getElementById(id).value = value; }
function submit(win, id) { win.document.getElementById(id).dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true })); }
function click(win, selector) { win.document.querySelector(selector).click(); }
function count(win, table, op) { return win.mock.calls.filter(c => c.table === table && c.op === op).length; }
function addItem(win, quantity = '3', value = '0.10') {
    field(win, 'item_produtoid', '9'); field(win, 'item_qt_produto', quantity); field(win, 'item_vl_unitario', value);
    click(win, '#btn-add-item');
}
function budget(win) {
    field(win, 'clienteid', '7'); field(win, 'dt_orcamento', '2026-09-11T10:00');
    field(win, 'dt_validade_orcamento', '2026-09-12T10:00'); addItem(win);
}
async function test(name, run) {
    try { await run(); results.push('OK: ' + name); }
    catch (error) { results.push('FAIL: ' + name + ' - ' + error.message); }
    document.getElementById('results').textContent = results.join('\n');
}

(async () => {
    await test('Menu alterna secoes no mesmo documento e preserva formularios', async () => {
        const w = await page('clientes');
        const documento = w.document;
        const form = documento.querySelector('#form-cliente');
        field(w, 'nome', 'Cadastro em andamento'); field(w, 'documento', '123.456.789-01');
        for (const secao of ['categorias', 'produtos', 'orcamentos', 'inicio', 'clientes']) {
            click(w, `[data-secao="${secao}"]`); await pause();
            assert(w.document === documento, 'A navegacao recarregou a pagina');
            assert(documento.querySelector('[aria-current="page"]').dataset.secao === secao, 'Menu ativo incorreto');
            const ids = [...documento.querySelectorAll('[id]')].map(el => el.id);
            assert(new Set(ids).size === ids.length, 'IDs de formularios se sobrepoem');
        }
        assert(documento.querySelector('#form-cliente') === form, 'Formulario foi recriado');
        assert(documento.querySelector('#nome').value === 'Cadastro em andamento', 'Rascunho perdido');
        submit(w, 'form-cliente'); await pause();
        assert(count(w, 'cliente', 'insert') === 1, 'Eventos duplicados ao voltar ao cadastro');
        assert(w.mock.errors.length === 0, w.mock.errors.join('; '));
    });
    await test('Atalho cadastra cliente e atualiza orcamento sem perder seus itens', async () => {
        const w = await page('orcamentos'); budget(w);
        const form = w.document.querySelector('#form-orcamento');
        click(w, '.acoes-formulario a[href="#clientes"]'); await pause();
        field(w, 'nome', 'Cliente pelo orçamento'); field(w, 'documento', '123.456.789-01');
        submit(w, 'form-cliente'); await pause();
        click(w, '[data-secao="orcamentos"]'); await pause();
        assert(w.document.querySelector('#form-orcamento') === form, 'Orcamento recriado');
        assert(w.document.querySelector('#clienteid').value === '7', 'Cliente selecionado perdido');
        assert([...w.document.querySelector('#clienteid').options].some(o => o.text.includes('Cliente pelo orçamento')), 'Novo cliente nao foi carregado');
        assert(w.document.querySelector('#vl_total_orcamento').value === '0.30', 'Itens do orcamento perdidos');
        assert(w.document.querySelector('#dt_orcamento').value === '2026-09-11T10:00', 'Data perdida');
        submit(w, 'form-orcamento'); await pause();
        assert(w.mock.data.orcamento_item.length === 1, 'Itens nao foram salvos');
    });
    await test('Atalho de categoria preserva produto em edicao e atualiza opcoes', async () => {
        const w = await page('produtos'); click(w, '[data-action="editar"]');
        field(w, 'dsproduto', 'Produto em edição');
        click(w, '.acoes-formulario a[href="#categorias"]'); await pause();
        field(w, 'descricao', 'Categoria pelo produto'); submit(w, 'form-categoria'); await pause();
        click(w, '[data-secao="produtos"]'); await pause();
        assert(w.document.querySelector('#dsproduto').value === 'Produto em edição', 'Edicao perdida');
        assert(w.document.querySelector('#categoriaprodutoid').value === '3', 'Categoria selecionada perdida');
        assert([...w.document.querySelector('#categoriaprodutoid').options].some(o => o.text.includes('Categoria pelo produto')), 'Categoria nova ausente');
        submit(w, 'form-produto'); await pause();
        assert(count(w, 'produto', 'update') === 1 && count(w, 'produto', 'insert') === 0, 'Edicao virou novo cadastro');
    });
    await test('Gravacao em andamento termina na secao correta apos navegar', async () => {
        const w = await page('clientes');
        field(w, 'nome', 'Cliente salvo em segundo plano'); field(w, 'documento', '123.456.789-01');
        let liberar;
        const espera = new Promise(resolve => { liberar = resolve; });
        w.mock.waitFor = query => query.op === 'insert' ? espera : null;
        submit(w, 'form-cliente'); await pause();
        click(w, '[data-secao="categorias"]'); await pause();
        field(w, 'descricao', 'Rascunho de categoria');
        liberar(); await pause();
        assert(w.document.querySelector('#descricao').value === 'Rascunho de categoria', 'Gravacao afetou outra secao');
        click(w, '[data-secao="clientes"]'); await pause();
        assert(w.document.querySelector('#nome').value === '', 'Formulario salvo nao foi limpo');
        assert(w.document.querySelector('#tabela-clientes').textContent.includes('Cliente salvo em segundo plano'), 'Lista nao atualizada');
        assert(w.mock.errors.length === 0, w.mock.errors.join('; '));
    });
    await test('Historico volta e avanca entre secoes sem perder rascunho', async () => {
        const w = await page('clientes'); field(w, 'nome', 'Rascunho no histórico');
        click(w, '[data-secao="categorias"]'); await pause();
        w.history.back(); await pause();
        assert(w.document.querySelector('#nome').value === 'Rascunho no histórico', 'Voltar perdeu a secao anterior');
        w.history.forward(); await pause();
        assert(w.document.querySelector('#form-categoria'), 'Avancar nao restaurou a secao');
        w.location.hash = '#inexistente'; await pause();
        assert(w.document.querySelector('.painel.inicio'), 'Secao desconhecida nao voltou ao inicio');
    });
    await test('Resposta antiga de listagem nao esconde cadastro recem-salvo', async () => {
        const w = await page('clientes');
        const listar = w.SCP.listar;
        let liberar;
        const antiga = new Promise(resolve => { liberar = resolve; });
        let primeira = true;
        w.SCP.listar = (...args) => {
            if (args[0] === 'cliente' && primeira) { primeira = false; return antiga; }
            return listar(...args);
        };
        click(w, '[data-secao="inicio"]'); await pause();
        click(w, '[data-secao="clientes"]'); await pause();
        field(w, 'nome', 'Cliente recém-salvo'); field(w, 'documento', '123.456.789-01');
        submit(w, 'form-cliente'); await pause();
        liberar([]); await pause();
        assert(w.document.querySelector('#tabela-clientes').textContent.includes('Cliente recém-salvo'), 'Resposta antiga substituiu a lista atualizada');
    });
    await test('Layout funciona no desktop e celular com menu acessivel', async () => {
        const w = await page('home');
        const sidebar = w.document.querySelector('.barra-lateral');
        assert(w.document.querySelector('.workspace').getBoundingClientRect().left >= sidebar.getBoundingClientRect().right, 'Conteudo sobrepoe barra lateral');
        const frame = document.querySelector('iframe'); frame.style.width = '390px'; await pause();
        const toggle = w.document.querySelector('.alternar-menu');
        assert(w.getComputedStyle(toggle).display !== 'none', 'Botao mobile oculto');
        assert(w.getComputedStyle(w.document.querySelector('#navegacao')).display === 'none', 'Menu mobile iniciou aberto');
        toggle.click();
        assert(toggle.getAttribute('aria-expanded') === 'true', 'Estado acessivel incorreto');
        w.document.dispatchEvent(new w.KeyboardEvent('keydown', {key: 'Escape'}));
        assert(toggle.getAttribute('aria-expanded') === 'false', 'Escape nao fecha o menu');
        for (const secao of ['clientes', 'categorias', 'produtos', 'orcamentos']) {
            toggle.click(); click(w, `[data-secao="${secao}"]`); await pause();
            assert(toggle.getAttribute('aria-expanded') === 'false', 'Navegacao nao fecha o menu');
            assert(w.document.documentElement.scrollWidth <= 390, 'Pagina ultrapassa largura do celular: ' + secao);
            assert(w.document.activeElement.id === 'titulo-secao', 'Foco nao acompanha a secao');
        }
    });
    await test('Todas as telas carregam sem erros de JavaScript', async () => {
        for (const name of ['index', 'home', 'clientes', 'categorias', 'produtos', 'orcamentos']) await page(name);
    });
    await test('Login demonstrativo rejeita credenciais invalidas', async () => {
        const w = await page('index'); field(w, 'usuario', 'invalido'); field(w, 'senha', 'invalida');
        submit(w, 'loginForm');
        assert(w.document.querySelector('#login-message').classList.contains('error'), 'Login invalido aceito');
        assert(w.document.querySelector('#senha').value === '', 'Senha invalida permaneceu no campo');
    });
    await test('Listas percorrem mais de uma pagina de resultados', async () => {
        const w = await page('categorias', "mock.data.categoria_produto = Array.from({length: 1001}, (_, i) => ({categoriaprodutoid: i + 1, ds_categoria_produto: 'Categoria ' + i}));");
        assert(w.document.querySelectorAll('#tabela-categorias tr').length === 1001, 'Listagem truncada');
        assert(count(w, 'categoria_produto', 'select') === 3, 'Paginacao incorreta');
    });
    await test('Listagem vazia e falha de rede ficam visiveis', async () => {
        let w = await page('clientes', 'mock.data.cliente = [];');
        assert(w.document.querySelector('#tabela-clientes').textContent.includes('Nenhum'), 'Estado vazio ausente');
        w = await page('categorias', "mock.failures.push({table: 'categoria_produto', op: 'select', throw: true});");
        assert(w.document.querySelector('#tabela-categorias').textContent.includes('Erro'), 'Falha invisivel');
    });
    await test('Categoria rejeita texto em branco e impede envio duplicado', async () => {
        const w = await page('categorias');
        field(w, 'descricao', '   '); submit(w, 'form-categoria'); await pause();
        assert(count(w, 'categoria_produto', 'insert') === 0, 'Texto vazio foi salvo');
        field(w, 'descricao', 'Nova'); submit(w, 'form-categoria'); submit(w, 'form-categoria'); await pause();
        assert(count(w, 'categoria_produto', 'insert') === 1, 'Gravacao duplicada');
        assert(w.document.querySelector('#descricao').value === '', 'Formulario nao foi limpo');
    });
    await test('Reset interno cancela edicao sem alterar o registro anterior', async () => {
        const w = await page('categorias');
        click(w, '[data-action="editar"]'); w.document.querySelector('#form-categoria').reset();
        field(w, 'descricao', 'Outra'); submit(w, 'form-categoria'); await pause();
        assert(count(w, 'categoria_produto', 'update') === 0, 'Edicao ficou ativa');
        assert(w.mock.data.categoria_produto.length === 2, 'Novo cadastro ausente');
    });
    await test('Atualizacao sem registro retornado nao anuncia sucesso', async () => {
        const w = await page('categorias'); click(w, '[data-action="editar"]'); field(w, 'descricao', 'Alterada');
        w.mock.failures.push({table: 'categoria_produto', op: 'update', data: []});
        submit(w, 'form-categoria'); await pause();
        assert(w.mock.alerts.some(a => a.includes('não foi atualizado')), 'Atualizacao inexistente ignorada');
        assert(w.document.querySelector('#descricao').value === 'Alterada', 'Dados perdidos na falha');
    });
    await test('Cliente usa maior codigo atual e repete apenas conflito de chave', async () => {
        const w = await page('clientes'); field(w, 'nome', 'Novo'); field(w, 'documento', '123.456.789-01');
        w.mock.failures.push({table: 'cliente', op: 'insert', error: {code: '23505', message: 'cliente_pkey'},
            effect() { w.mock.data.cliente.push({clienteid: 8, nome_cliente: 'Concorrente'}); }});
        submit(w, 'form-cliente'); await pause();
        assert(w.mock.data.cliente.some(c => c.clienteid === 9 && c.nome_cliente === 'Novo'), 'Conflito de codigo nao recuperado');
        assert(count(w, 'cliente', 'insert') === 2, 'Quantidade incorreta de tentativas');
    });
    await test('Cliente nao repete erro de documento duplicado', async () => {
        const w = await page('clientes'); field(w, 'nome', 'Novo'); field(w, 'documento', '123.456.789-01');
        w.mock.failures.push({table: 'cliente', op: 'insert', error: {code: '23505', message: 'documento_key'}});
        submit(w, 'form-cliente'); await pause();
        assert(count(w, 'cliente', 'insert') === 1, 'Repeticao indevida');
    });
    await test('Mascara de CPF formata digitacao e colagem sem perder zeros', async () => {
        const w = await page('clientes');
        const input = w.document.querySelector('#documento');
        field(w, 'documento', '0012'); input.dispatchEvent(new w.Event('input'));
        assert(input.value === '001.2', 'Mascara parcial incorreta');
        field(w, 'documento', 'abc00123456789000'); input.dispatchEvent(new w.Event('input'));
        assert(input.value === '001.234.567-89', 'Colagem ou limite do CPF incorreto');
        assert(input.checkValidity(), 'CPF completo rejeitado pela mascara');
        input.setRangeText('9', 4, 5, 'end'); input.dispatchEvent(new w.Event('input'));
        assert(input.value === '001.934.567-89' && input.selectionStart === 5, 'Cursor saltou ao editar no meio');
    });
    await test('Mascara de CNPJ aceita numeros e letras nas posicoes corretas', async () => {
        const w = await page('clientes'); click(w, '#pj');
        const input = w.document.querySelector('#documento');
        field(w, 'documento', '12345678000199'); input.dispatchEvent(new w.Event('input'));
        assert(input.value === '12.345.678/0001-99' && input.checkValidity(), 'CNPJ numerico incorreto');
        field(w, 'documento', '00.000.000/e08g-12'); input.dispatchEvent(new w.Event('input'));
        assert(input.value === '00.000.000/E08G-12' && input.checkValidity(), 'CNPJ alfanumerico incorreto');
        assert(input.inputMode === 'text' && input.maxLength === 18, 'Configuracao de CNPJ incorreta');
    });
    await test('Trocar tipo limpa documento e reset restaura mascara de CPF', async () => {
        const w = await page('clientes'); field(w, 'documento', '123.456.789-01'); click(w, '#pj');
        assert(w.document.querySelector('#documento').value === '', 'CPF foi convertido indevidamente em CNPJ');
        assert(w.document.querySelector('label[for="documento"]').textContent === 'CNPJ:', 'Rotulo nao alterado');
        w.document.querySelector('#form-cliente').reset(); await pause();
        const input = w.document.querySelector('#documento');
        assert(input.placeholder === '000.000.000-00' && input.maxLength === 14 && input.inputMode === 'numeric', 'Reset manteve mascara errada');
    });
    await test('Edicao de cliente aplica mascara correspondente ao cadastro', async () => {
        const w = await page('clientes', "mock.data.cliente[0].tipo_cliente = 'J'; mock.data.cliente[0].cpf_cnpj_cliente = '12345678000199';");
        click(w, '[data-action="editar"]');
        const input = w.document.querySelector('#documento');
        assert(w.document.querySelector('#pj').checked && input.value === '12.345.678/0001-99', 'Edicao nao carregou CNPJ formatado');
        assert(input.checkValidity(), 'Documento editado nao passa na mascara');
    });
    await test('Documento incompleto bloqueia envio e documento completo salva formatado', async () => {
        const w = await page('clientes'); field(w, 'nome', 'Teste');
        const input = w.document.querySelector('#documento');
        field(w, 'documento', '1234'); input.dispatchEvent(new w.Event('input'));
        submit(w, 'form-cliente'); await pause();
        assert(count(w, 'cliente', 'insert') === 0, 'CPF incompleto foi salvo');
        field(w, 'documento', '12345678901'); input.dispatchEvent(new w.Event('input'));
        submit(w, 'form-cliente'); await pause();
        assert(w.mock.data.cliente.some(c => c.cpf_cnpj_cliente === '123.456.789-01'), 'Documento formatado nao foi salvo');
    });
    await test('Exclusao com vinculo mantem os dados e libera botoes', async () => {
        const w = await page('clientes');
        w.mock.failures.push({table: 'cliente', op: 'delete', error: {code: '23503'}});
        click(w, '[data-action="excluir"]'); await pause();
        assert(w.mock.data.cliente.length === 1 && w.mock.alerts.length === 1, 'Erro de vinculo ignorado');
        assert(!w.document.querySelector('#botao-salvar').disabled, 'Formulario ficou bloqueado');
    });
    await test('Produto seleciona categoria e preserva observacao nula como vazia', async () => {
        const w = await page('produtos'); click(w, '[data-action="editar"]');
        assert(w.document.querySelector('#categoriaprodutoid').value === '3', 'Categoria nao selecionada');
        assert(w.document.querySelector('#obsproduto').value === '', 'Texto null no formulario');
        field(w, 'vl_venda_produto', '0'); submit(w, 'form-produto'); await pause();
        assert(w.mock.data.produto[0].vl_venda_produto === 0, 'Preco zero rejeitado');
    });
    await test('Produto sem categoria ou com preco negativo nao e salvo', async () => {
        const w = await page('produtos'); field(w, 'dsproduto', 'Teste'); field(w, 'status_produto', 'Ativo');
        field(w, 'vl_venda_produto', '2'); submit(w, 'form-produto');
        field(w, 'categoriaprodutoid', '3'); field(w, 'vl_venda_produto', '-1'); submit(w, 'form-produto'); await pause();
        assert(count(w, 'produto', 'insert') === 0, 'Produto invalido gravado');
    });
    await test('Orcamento carrega clientes e preenche o valor de venda ao selecionar produto', async () => {
        const w = await page('orcamentos');
        assert(w.document.querySelector('#clienteid').textContent.includes('Cliente de teste'), 'Cliente ausente');
        field(w, 'item_produtoid', '9'); w.document.querySelector('#item_produtoid').dispatchEvent(new w.Event('change'));
        assert(w.document.querySelector('#item_vl_unitario').value === '0.10', 'Preco de venda nao preenchido');
        field(w, 'item_qt_produto', '3'); click(w, '#btn-add-item');
        assert(w.document.querySelector('#vl_total_orcamento').value === '0.30', 'Subtotal nao usou preco automatico');
        assert(w.document.querySelector('#item_vl_unitario').value === '', 'Preco nao foi limpo apos adicionar');
    });
    await test('Trocar produto substitui preco, aceita zero e limpa selecao vazia', async () => {
        const w = await page('orcamentos', `mock.data.produto.push(
            {produtoid: 10, ds_produto: 'Brinde', vl_venda_produto: 0},
            {produtoid: 11, ds_produto: 'Sem preco', vl_venda_produto: null}
        );`);
        const select = w.document.querySelector('#item_produtoid');
        for (const [id, preco] of [['9', '0.10'], ['10', '0.00'], ['11', ''], ['9', '0.10'], ['', '']]) {
            field(w, 'item_produtoid', id); select.dispatchEvent(new w.Event('change'));
            assert(w.document.querySelector('#item_vl_unitario').value === preco, 'Preco incorreto ao selecionar ' + id);
        }
    });
    await test('Preco negociado e salvo no orcamento sem modificar cadastro do produto', async () => {
        const w = await page('orcamentos', 'mock.data.produto[0].vl_venda_produto = 85;');
        field(w, 'clienteid', '7'); field(w, 'dt_orcamento', '2026-09-11T10:00');
        field(w, 'dt_validade_orcamento', '2026-09-12T10:00');
        field(w, 'item_produtoid', '9'); w.document.querySelector('#item_produtoid').dispatchEvent(new w.Event('change'));
        assert(w.document.querySelector('#item_vl_unitario').value === '85.00', 'Preco cadastrado ausente');
        field(w, 'item_vl_unitario', '80.00'); field(w, 'item_qt_produto', '2');
        click(w, '#btn-add-item'); submit(w, 'form-orcamento'); await pause();
        assert(w.mock.data.orcamento_item[0].vl_unitario === 80 && w.mock.data.orcamento[0].vl_total_orcamento === 160, 'Negociacao nao persistida');
        assert(w.mock.data.produto[0].vl_venda_produto === 85 && count(w, 'produto', 'update') === 0, 'Negociacao alterou produto');
        click(w, '#fechar-orcamento'); await pause();
        w.mock.data.produto[0].vl_venda_produto = 100;
        click(w, '#btn-atualizar-produtos'); await pause();
        field(w, 'item_produtoid', '9'); w.document.querySelector('#item_produtoid').dispatchEvent(new w.Event('change'));
        assert(w.document.querySelector('#item_vl_unitario').value === '100.00', 'Lista atualizada nao usou novo preco');
        click(w, '[data-acao="visualizar"]'); await pause();
        assert(w.document.querySelector('#itens-documento tr').cells[2].textContent === w.SCP.moeda(80), 'Novo preco mudou orcamento salvo');
    });
    await test('Orcamento impede envio sem clientes e permite atualizar lista', async () => {
        const w = await page('orcamentos', 'mock.data.cliente = [];');
        assert(w.document.querySelector('#botao-salvar').disabled, 'Envio liberado sem clientes');
        w.mock.data.cliente.push({clienteid: 7, nome_cliente: 'Novo'}); click(w, '#btn-atualizar-clientes'); await pause();
        assert(!w.document.querySelector('#botao-salvar').disabled, 'Atualizacao nao liberou envio');
    });
    await test('Orcamento trata falha ao carregar produtos e permite nova tentativa', async () => {
        const w = await page('orcamentos', "mock.failures.push({table: 'produto', op: 'select', throw: true});");
        assert(w.document.querySelector('#btn-add-item').disabled, 'Adicao liberada sem produtos');
        click(w, '#btn-atualizar-produtos'); await pause();
        assert(!w.document.querySelector('#btn-add-item').disabled, 'Lista nao recuperada');
    });
    await test('Atualizacao lenta de produtos nao concorre com o salvamento', async () => {
        const w = await page('orcamentos'); budget(w);
        let release;
        w.mock.waitFor = query => query.table === 'produto' && query.op === 'select'
            ? new Promise(resolve => { release = resolve; }) : Promise.resolve();
        click(w, '#btn-atualizar-produtos'); await pause();
        submit(w, 'form-orcamento'); await pause();
        assert(count(w, 'orcamento', 'insert') === 0, 'Salvamento concorreu com a lista');
        release(); await pause();
        assert(!w.document.querySelector('#botao-salvar').disabled && !w.document.querySelector('#btn-atualizar-produtos').disabled, 'Botoes ficaram bloqueados');
        submit(w, 'form-orcamento'); await pause();
        assert(count(w, 'orcamento', 'insert') === 1, 'Salvamento nao retomou');
    });
    await test('Atualizacao lenta de categorias protege a edicao de produtos', async () => {
        const w = await page('produtos');
        let release;
        w.mock.waitFor = query => query.table === 'categoria_produto' && query.op === 'select'
            ? new Promise(resolve => { release = resolve; }) : Promise.resolve();
        click(w, '#btn-atualizar-categorias'); await pause();
        click(w, '[data-action="editar"]');
        assert(w.document.querySelector('#codigo').value === '', 'Edicao iniciou com lista pendente');
        release(); await pause(); click(w, '[data-action="editar"]');
        assert(w.document.querySelector('#categoriaprodutoid').value === '3', 'Categoria da edicao foi perdida');
    });
    await test('Calculo monetario, remocao e limpeza de itens', async () => {
        const w = await page('orcamentos'); addItem(w); addItem(w, '1', '0.20');
        assert(w.document.querySelector('#vl_total_orcamento').value === '0.50', 'Total incorreto');
        click(w, '[data-indice="0"]');
        assert(w.document.querySelector('#vl_total_orcamento').value === '0.20', 'Remocao nao recalculou');
        w.document.querySelector('#form-orcamento').reset(); await pause();
        assert(w.document.querySelector('#vl_total_orcamento').value === '0.00', 'Reset interno nao zerou total');
        assert(w.document.querySelector('#tabela-itens-temporarios').textContent.includes('Nenhum'), 'Carrinho nao foi limpo');
    });
    await test('Itens rejeitam quantidade e preco invalidos', async () => {
        const w = await page('orcamentos'); addItem(w, '-1'); addItem(w, '0'); addItem(w, '1.5'); addItem(w, '1', '-1');
        assert(!w.document.querySelector('[data-indice]'), 'Item invalido adicionado');
    });
    await test('Validade anterior nao grava orcamento', async () => {
        const w = await page('orcamentos'); budget(w); field(w, 'dt_validade_orcamento', '2026-09-10T10:00');
        submit(w, 'form-orcamento'); await pause();
        assert(count(w, 'orcamento', 'insert') === 0, 'Datas invalidas gravadas');
    });
    await test('Orcamento envia vinculos corretos uma unica vez', async () => {
        const w = await page('orcamentos'); budget(w); submit(w, 'form-orcamento'); submit(w, 'form-orcamento'); await pause();
        assert(count(w, 'orcamento', 'insert') === 1 && count(w, 'orcamento_item', 'insert') === 1, 'Orcamento duplicado');
        assert(String(w.mock.data.orcamento[0].clienteid) === '7', 'Cliente errado');
        assert(w.mock.data.orcamento_item[0].orcamentoid === w.mock.data.orcamento[0].orcamentoid, 'Vinculo errado');
        assert(w.mock.data.orcamento[0].vl_total_orcamento === 0.3, 'Total errado');
        assert(w.document.querySelector('#vl_total_orcamento').value === '0.00', 'Carrinho nao foi limpo apos salvar');
    });
    await test('Banco simulado exige codigo do item e chave composta unica', async () => {
        const w = await page('orcamentos');
        const missing = await w.supabaseClient.from('orcamento_item').insert([{orcamentoid: 10, produtoid: 9}]);
        assert(missing.error?.code === '23502', 'Mock ainda gera codigo do item automaticamente');
        const valid = await w.supabaseClient.from('orcamento_item').insert([
            {orcamentoid: 10, orcamentoitemid: 1}, {orcamentoid: 11, orcamentoitemid: 1}
        ]);
        assert(!valid.error, 'Mesmo numero em orcamentos distintos foi rejeitado');
        const duplicate = await w.supabaseClient.from('orcamento_item').insert([
            {orcamentoid: 10, orcamentoitemid: 2}, {orcamentoid: 10, orcamentoitemid: 1}
        ]);
        assert(duplicate.error?.code === '23505', 'Chave composta duplicada foi aceita');
        assert(w.mock.data.orcamento_item.length === 2, 'Lote invalido foi gravado parcialmente');
    });
    await test('Itens recebem numeros distintos apos remover item do carrinho', async () => {
        const w = await page('orcamentos'); budget(w); addItem(w, '2'); addItem(w, '4');
        click(w, '[data-indice="1"]'); submit(w, 'form-orcamento'); await pause();
        const payload = w.mock.calls.find(c => c.table === 'orcamento_item' && c.op === 'insert').values;
        assert(payload.length === 2 && payload[0].orcamentoitemid === 1 && payload[1].orcamentoitemid === 2, 'Numeracao incorreta no envio');
        assert(payload[0].qt_produto === 3 && payload[1].qt_produto === 4, 'Itens incorretos enviados');
        assert(w.mock.data.orcamento_item.length === 2, 'Itens nao foram gravados');
    });
    await test('Novo orcamento reinicia numeracao dos itens sem conflito', async () => {
        const w = await page('orcamentos'); budget(w); submit(w, 'form-orcamento'); await pause();
        click(w, '#fechar-orcamento'); await pause();
        budget(w); submit(w, 'form-orcamento'); await pause();
        const itens = w.mock.data.orcamento_item;
        assert(itens.length === 2, 'Segundo orcamento nao foi salvo');
        assert(itens[0].orcamentoitemid === 1 && itens[1].orcamentoitemid === 1, 'Numeracao nao reiniciou');
        assert(itens[0].orcamentoid !== itens[1].orcamentoid, 'Itens vinculados ao mesmo orcamento');
        assert(w.mock.alerts.length === 0, 'Erro inesperado ao salvar');
    });
    await test('Falha confirmada nos itens desfaz cabecalho e preserva formulario', async () => {
        const w = await page('orcamentos'); budget(w);
        w.mock.failures.push({table: 'orcamento_item', op: 'insert', error: {code: '23503'}});
        submit(w, 'form-orcamento'); await pause();
        assert(w.mock.data.orcamento.length === 0, 'Cabecalho vazio permaneceu');
        assert(w.document.querySelector('#vl_total_orcamento').value === '0.30', 'Carrinho perdido');
        assert(!w.document.querySelector('#botao-salvar').disabled, 'Nova tentativa bloqueada');
    });
    await test('Falha de rede nos itens nao apaga nem duplica gravação incerta', async () => {
        const w = await page('orcamentos'); budget(w);
        w.mock.failures.push({table: 'orcamento_item', op: 'insert', throw: true});
        submit(w, 'form-orcamento'); await pause(); submit(w, 'form-orcamento'); await pause();
        assert(count(w, 'orcamento', 'delete') === 0 && count(w, 'orcamento', 'insert') === 1, 'Gravacao incerta alterada');
        assert(w.document.querySelector('#botao-salvar').disabled, 'Reenvio liberado');
    });
    await test('Falha na compensacao informa o codigo e impede reenvio', async () => {
        const w = await page('orcamentos'); budget(w);
        w.mock.failures.push({table: 'orcamento_item', op: 'insert', error: {code: '23503'}},
            {table: 'orcamento', op: 'delete', error: {code: '42501'}});
        submit(w, 'form-orcamento'); await pause();
        assert(w.document.querySelector('#status-orcamento').textContent.includes('orçamento 1'), 'Codigo pendente nao informado');
        assert(w.document.querySelector('#botao-salvar').disabled, 'Reenvio duplicaria cabecalho');
    });
    await test('Falha de rede no cabecalho bloqueia repeticao incerta', async () => {
        const w = await page('orcamentos'); budget(w);
        w.mock.failures.push({table: 'orcamento', op: 'insert', throw: true});
        submit(w, 'form-orcamento'); await pause(); submit(w, 'form-orcamento'); await pause();
        assert(count(w, 'orcamento', 'insert') === 1, 'Cabecalho repetido apos falha de rede');
        assert(count(w, 'orcamento_item', 'insert') === 0, 'Itens enviados sem cabecalho');
    });
    await test('Falha na exclusao dos itens interrompe exclusao do cabecalho', async () => {
        const w = await page('orcamentos', 'mock.data.orcamento = [{orcamentoid: 4, clienteid: 7, vl_total_orcamento: 2}];');
        w.mock.failures.push({table: 'orcamento_item', op: 'delete', error: {code: '42501'}});
        click(w, '#tabela-orcamentos [data-acao="excluir"]'); await pause();
        assert(count(w, 'orcamento', 'delete') === 0, 'Cabecalho excluido apos falha dos itens');
    });
    await test('Exclusao de orcamento remove itens antes do cabecalho', async () => {
        const w = await page('orcamentos', 'mock.data.orcamento = [{orcamentoid: 4, clienteid: 7}]; mock.data.orcamento_item = [{orcamentoitemid: 1, orcamentoid: 4}];');
        click(w, '#tabela-orcamentos [data-acao="excluir"]'); await pause();
        const deletes = w.mock.calls.filter(c => c.op === 'delete');
        assert(deletes[0].table === 'orcamento_item' && deletes[1].table === 'orcamento', 'Ordem incorreta');
        assert(!w.mock.data.orcamento.length && !w.mock.data.orcamento_item.length, 'Exclusao incompleta');
    });
    await test('Exclusao parcial de orcamento recebe aviso explicito', async () => {
        const w = await page('orcamentos', 'mock.data.orcamento = [{orcamentoid: 4, clienteid: 7}];');
        w.mock.failures.push({table: 'orcamento', op: 'delete', error: {code: '42501'}});
        click(w, '#tabela-orcamentos [data-acao="excluir"]'); await pause();
        assert(w.document.querySelector('#status-orcamento').textContent.includes('itens podem ter sido removidos'), 'Falha parcial nao informada');
        assert(!w.document.querySelector('#botao-salvar').disabled, 'Formulario nao liberado');
    });
    await test('Documento abre apos salvar e reabre com os valores persistidos', async () => {
        const w = await page('orcamentos'); budget(w); submit(w, 'form-orcamento'); await pause();
        const dialog = w.document.querySelector('#visualizacao-orcamento');
        assert(dialog.open && !w.document.querySelector('#documento-orcamento').hidden, 'Documento nao abriu apos salvar');
        assert(w.document.querySelector('[data-documento="cliente"]').textContent === 'Cliente de teste', 'Cliente ausente');
        assert(w.document.querySelector('[data-documento="cpf"]').textContent === 'documento', 'Documento do cliente ausente');
        assert(w.document.querySelector('#itens-documento').textContent.includes('Produto de teste'), 'Descricao ausente');
        click(w, '#fechar-orcamento'); await pause();
        assert(!dialog.open, 'Documento nao fechou');
        w.mock.data.orcamento[0].vl_total_orcamento = 42;
        w.mock.data.orcamento_item[0].vl_unitario = 14;
        w.mock.data.orcamento_item[0].vl_total = 42;
        w.mock.data.produto[0].vl_venda_produto = 999;
        w.mock.data.orcamento_item.push({orcamentoid: 999, orcamentoitemid: 1, produtoid: 9, qt_produto: 99});
        addItem(w, '2', '100');
        click(w, '#tabela-orcamentos [data-acao="visualizar"]'); await pause();
        assert(w.document.querySelector('[data-documento="total"]').textContent === w.SCP.moeda(42), 'Documento usou carrinho ou total antigo');
        const rows = w.document.querySelectorAll('#itens-documento tr');
        assert(rows.length === 1 && rows[0].cells[2].textContent === w.SCP.moeda(14), 'Itens misturados ou preco atual usado');
        assert(count(w, 'orcamento', 'delete') === 0, 'Visualizar excluiu registro');
    });
    await test('Documento permite imprimir somente a copia e limpa depois', async () => {
        const w = await page('orcamentos'); budget(w); submit(w, 'form-orcamento'); await pause();
        const title = w.document.title;
        let printed = false;
        w.print = () => {
            const copy = w.document.querySelector('body > .copia-orcamento');
            assert(copy && copy.textContent.includes('Produto de teste'), 'Copia para impressao ausente');
            assert(!copy.querySelector('button, input, [id]'), 'Copia tem controles ou IDs duplicados');
            assert(w.document.body.classList.contains('imprimindo-orcamento'), 'Estilo de impressao nao ativado');
            printed = true;
        };
        click(w, '#imprimir-orcamento');
        assert(printed && !w.document.querySelector('.copia-orcamento'), 'Impressao nao executada ou copia nao removida');
        assert(w.document.title === title && !w.document.body.classList.contains('imprimindo-orcamento'), 'Tela nao restaurada');
    });
    await test('Falha ao consultar oculta documento anterior e permite tentar novamente', async () => {
        const w = await page('orcamentos'); budget(w); submit(w, 'form-orcamento'); await pause();
        click(w, '#fechar-orcamento'); await pause();
        w.mock.failures.push({table: 'orcamento_item', op: 'select', throw: true});
        click(w, '[data-acao="visualizar"]'); await pause();
        assert(w.document.querySelector('#documento-orcamento').hidden, 'Documento antigo exibido apos falha');
        assert(w.document.querySelector('#imprimir-orcamento').disabled, 'Impressao de dados incompletos liberada');
        assert(w.document.querySelector('#status-documento').textContent.includes('Não foi possível'), 'Erro nao informado');
        click(w, '#fechar-orcamento'); await pause();
        click(w, '[data-acao="visualizar"]'); await pause();
        assert(!w.document.querySelector('#documento-orcamento').hidden, 'Nova tentativa nao abriu documento');
    });
    await test('Documento pagina itens, preserva texto e suporta cadastros indisponiveis', async () => {
        const w = await page('orcamentos', `
            mock.data.orcamento = [{orcamentoid: 4, clienteid: 777, vl_total_orcamento: 0}];
            mock.data.produto[0].ds_produto = '<img src=x onerror=alert(1)>';
            mock.data.orcamento_item = Array.from({length: 501}, (_, i) => ({
                orcamentoid: 4, orcamentoitemid: i + 1, produtoid: i === 500 ? 999 : 9,
                qt_produto: 1, vl_unitario: 0, vl_total: 0
            }));
        `);
        click(w, '[data-acao="visualizar"]'); await pause();
        assert(w.document.querySelectorAll('#itens-documento tr').length === 501, 'Itens truncados');
        assert(!w.document.querySelector('#itens-documento img'), 'Descricao interpretada como HTML');
        assert(w.document.querySelector('#itens-documento').textContent.includes('Produto #999'), 'Produto indisponivel omitiu item');
        assert(w.document.querySelector('[data-documento="cliente"]').textContent.includes('#777'), 'Cliente indisponivel impediu consulta');
        assert(w.document.querySelector('[data-documento="total"]').textContent === w.SCP.moeda(0), 'Zero perdido');
    });
    await test('Renderizacao trata nomes como texto e conserva valor zero', async () => {
        const w = await page('clientes', 'mock.data.cliente[0].nome_cliente = "<img src=x onerror=alert(1)>";');
        assert(!w.document.querySelector('#tabela-clientes img'), 'Nome interpretado como HTML');
        const row = w.document.createElement('tr'); w.SCP.criarCelula(row, 0);
        assert(row.textContent === '0', 'Valor zero oculto');
    });
    results.push('COMPLETE: ' + results.filter(r => r.startsWith('OK')).length + '/' + results.length);
    document.getElementById('results').textContent = results.join('\n');
})();
