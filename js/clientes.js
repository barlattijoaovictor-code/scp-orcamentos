window.iniciarClientes = (raiz) => {
    const formCliente = raiz.querySelector('#form-cliente');
    const documentoInput = raiz.querySelector('#documento');
    const documentoLabel = raiz.querySelector('label[for="documento"]');

    function pessoaJuridica() {
        return formCliente.querySelector('#pj').checked;
    }

    function caracteresDocumento(valor) {
        if (!pessoaJuridica()) return valor.replace(/\D/g, '').slice(0, 11);
        // CNPJ: 12 posições alfanuméricas e dois dígitos numéricos.
        const caracteres = valor.toUpperCase().replace(/[^A-Z0-9]/g, '');
        return caracteres.slice(0, 12) + caracteres.slice(12).replace(/\D/g, '').slice(0, 2);
    }

    function aplicarMascaraDocumento() {
        const inicio = caracteresDocumento(documentoInput.value.slice(0, documentoInput.selectionStart)).length;
        const fim = caracteresDocumento(documentoInput.value.slice(0, documentoInput.selectionEnd)).length;
        const caracteres = caracteresDocumento(documentoInput.value);
        const modelo = pessoaJuridica() ? '##.###.###/####-##' : '###.###.###-##';
        let formatado = '';
        let indice = 0;
        for (const simbolo of modelo) {
            if (indice >= caracteres.length) break;
            formatado += simbolo === '#' ? caracteres[indice++] : simbolo;
        }
        documentoInput.value = formatado;

        // Mantém o cursor na posição editada, sem saltar para o fim do documento.
        function posicaoCursor(quantidade) {
            let posicao = 0;
            let encontrados = 0;
            while (posicao < formatado.length && encontrados < quantidade) {
                if (/[A-Z0-9]/.test(formatado[posicao])) encontrados++;
                posicao++;
            }
            return posicao;
        }
        documentoInput.setSelectionRange(posicaoCursor(inicio), posicaoCursor(fim));
    }

    function atualizarTipoDocumento() {
        const juridica = pessoaJuridica();
        documentoLabel.textContent = juridica ? 'CNPJ:' : 'CPF:';
        documentoInput.placeholder = juridica ? '00.000.000/0000-00' : '000.000.000-00';
        documentoInput.maxLength = juridica ? 18 : 14;
        documentoInput.inputMode = juridica ? 'text' : 'numeric';
        documentoInput.autocapitalize = juridica ? 'characters' : 'off';
        documentoInput.pattern = juridica
            ? '[A-Z0-9]{2}[.][A-Z0-9]{3}[.][A-Z0-9]{3}/[A-Z0-9]{4}-[0-9]{2}'
            : '[0-9]{3}[.][0-9]{3}[.][0-9]{3}-[0-9]{2}';
        documentoInput.title = juridica ? 'Informe o CNPJ completo, com 14 caracteres.' : 'Informe o CPF completo, com 11 dígitos.';
        aplicarMascaraDocumento();
    }

    documentoInput.addEventListener('input', aplicarMascaraDocumento);
    formCliente.querySelectorAll('[name="tipo_cliente"]').forEach(radio => {
        radio.addEventListener('change', () => {
            // CPF e CNPJ identificam pessoas diferentes: não converte um documento no outro.
            documentoInput.value = '';
            atualizarTipoDocumento();
            documentoInput.focus();
        });
    });
    formCliente.addEventListener('reset', () => queueMicrotask(atualizarTipoDocumento));
    atualizarTipoDocumento();

    const cadastro = iniciarCadastro({
        raiz,
        form: '#form-cliente', tabela: '#tabela-clientes', entidade: 'cliente', id: 'clienteid',
        colunas: 'clienteid, tipo_cliente, cpf_cnpj_cliente, nome_cliente',
        celulas: [c => c.clienteid, c => c.tipo_cliente === 'F' ? 'PF' : 'PJ',
            c => c.cpf_cnpj_cliente, c => c.nome_cliente],
        nome: c => `o cliente ${c.nome_cliente}`,
        dados(form) {
            return {
                tipo_cliente: form.querySelector('[name="tipo_cliente"]:checked').value === 'PF' ? 'F' : 'J',
                cpf_cnpj_cliente: SCP.texto(form.querySelector('#documento').value, 'o documento'),
                nome_cliente: SCP.texto(form.querySelector('#nome').value, 'o nome do cliente')
            };
        },
        editar(form, cliente) {
            form.querySelector(cliente.tipo_cliente === 'F' ? '#pf' : '#pj').checked = true;
            form.querySelector('#documento').value = cliente.cpf_cnpj_cliente ?? '';
            atualizarTipoDocumento();
            form.querySelector('#nome').value = cliente.nome_cliente ?? '';
            form.querySelector('#nome').focus();
        },
        async inserir(dados) {
            // Compatibilidade com o cadastro existente, que envia clienteid explicitamente.
            // A migração para IDENTITY depende da confirmação do esquema do banco.
            for (let tentativa = 0; tentativa < 3; tentativa++) {
                const ultimos = await SCP.consultar(window.supabaseClient.from('cliente')
                    .select('clienteid').order('clienteid', { ascending: false }).limit(1));
                const clienteid = Number(ultimos?.[0]?.clienteid || 0) + 1;
                if (!Number.isSafeInteger(clienteid)) throw new Error('Código de cliente acima do limite permitido.');
                const { error } = await window.supabaseClient.from('cliente').insert([{ ...dados, clienteid }]);
                if (!error) return;
                const conflitoCodigo = error.code === '23505' &&
                    (String(error.message).includes('cliente_pkey') || String(error.details).includes('Key (clienteid)'));
                if (!conflitoCodigo || tentativa === 2) throw error;
            }
        }
    });

    return { ativar: cadastro.carregar };
};
