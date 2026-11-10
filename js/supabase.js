// Substitua pelas credenciais encontradas em Project Settings -> API no painel do Supabase
const SUPABASE_URL = 'https://eqrnikrjobiggwbcjkqm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_NUlgDrdJLgpkCwdxyeiZJA_Tg30Ao2x';

if (!window.supabase) {
    throw new Error('A biblioteca do Supabase não foi carregada.');
}

window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
