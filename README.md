# SCP – Sistema de Controle de Orçamentos

Sistema web para cadastro de clientes, categorias e produtos e criação de orçamentos, com banco de dados no **Supabase**.
Projeto desenvolvido no programa **Desenvolvimento de Aplicações Web – SaberTI / Accion (2026)**, com apoio de IA.

## Funcionalidades

- Tela de login (demonstração)
- Cadastro, edição e exclusão de **clientes** (pessoa física ou jurídica, com máscara de CPF/CNPJ)
- Cadastro de **categorias** e **produtos**
- Criação de **orçamentos** com vários itens e cálculo automático do total
- Menu lateral, adaptado para celular

## Tecnologias

- HTML, CSS e JavaScript
- Supabase (banco de dados PostgreSQL)

## Como executar

1. Baixe ou clone este repositório.
2. Abra o `index.html` no navegador (de preferência com a extensão Live Server do VS Code).
3. Entre com o login de demonstração:
   - **Usuário:** `admin321`
   - **Senha:** `123`

> O login é apenas uma demonstração e não usa autenticação real.

## Estrutura

```
├── index.html      → tela de login
├── home.html       → sistema (início, clientes, categorias, produtos e orçamentos)
├── css/            → estilos
├── js/             → lógica de cada tela e conexão com o Supabase
├── supabase/       → scripts SQL usados no banco
└── tests/          → testes automatizados no navegador
```

## Autor

João Victor Barlati
