// Compatibilidade dos endereços antigos com o menu integrado.
(() => {
    const pagina = location.pathname.split('/').pop().replace(/\.html$/, '');
    const secao = ['clientes', 'categorias', 'produtos', 'orcamentos'].includes(pagina) ? pagina : 'inicio';
    location.replace(`home.html#${secao}`);
})();
