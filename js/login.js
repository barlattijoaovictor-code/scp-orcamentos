const loginForm = document.querySelector('#loginForm');
// Login de demonstração: não cria sessão no Supabase Auth.
const usuarioInput = document.querySelector('#usuario');
const senhaInput = document.querySelector('#senha');
const loginMessage = document.querySelector('#login-message');

loginForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const usuarioValido = usuarioInput.value.trim() === 'admin321';
    const senhaValida = senhaInput.value === '123';

    if (usuarioValido && senhaValida) {
        loginMessage.textContent = 'Login realizado com sucesso!';
        loginMessage.className = 'login-message success';
        window.location.href = 'home.html';
        return;
    }

    loginMessage.textContent = 'Usuário ou senha incorretos.';
    loginMessage.className = 'login-message error';
    senhaInput.value = '';
    senhaInput.focus();
});
