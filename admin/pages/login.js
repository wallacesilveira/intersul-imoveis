/*!
 * Intersul Imóveis — Plataforma
 * Desenvolvido por Wallace Silveira · linkedin.com/in/wallacesilveira
 * © 2026 Wallace Silveira. Todos os direitos reservados.
 */
/* Telas sem login: entrar, recuperar senha e definir nova senha. */
import { alertBox, errorMessage } from '../lib/ui.js';
import { sessionRepository } from '../repositories/session.js';

function authShell(content) {
  return `<main class="auth-screen"><section class="auth-card"><div class="auth-brand"><img src="../Logo.png" alt=""><div><strong>INTERSUL IMÓVEIS</strong><span>Painel administrativo</span></div></div>${content}</section><a class="auth-back" href="../">Voltar ao site</a></main>`;
}

async function withBusy(form, action) {
  const button = form.querySelector('button[type="submit"]');
  const label = button.textContent;
  button.disabled = true;
  button.textContent = 'Aguarde...';
  try { await action(); } finally { button.disabled = false; button.textContent = label; }
}

export function renderLogin(root, { onSignedIn, message = '' }) {
  root.innerHTML = authShell(`<h1>Entrar</h1>${alertBox(message, 'info')}<form class="stack" data-login><div class="field"><label for="login-email">E-mail</label><input id="login-email" name="email" type="email" autocomplete="username" required></div><div class="field"><label for="login-password">Senha</label><input id="login-password" name="password" type="password" autocomplete="current-password" required></div><div data-feedback></div><button class="btn btn-primary btn-block" type="submit">Entrar</button></form><button class="link-button" type="button" data-forgot>Esqueci minha senha</button>`);
  const form = root.querySelector('[data-login]');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    withBusy(form, async () => {
      try {
        const user = await sessionRepository.signIn(form.email.value.trim(), form.password.value);
        await onSignedIn(user);
      } catch (error) {
        form.querySelector('[data-feedback]').innerHTML = alertBox(errorMessage(error));
      }
    });
  });
  root.querySelector('[data-forgot]').addEventListener('click', () => renderForgotPassword(root, { onSignedIn, email: form.email.value.trim() }));
}

function renderForgotPassword(root, { onSignedIn, email }) {
  root.innerHTML = authShell(`<h1>Recuperar senha</h1><p class="muted">Enviaremos um link para você definir uma nova senha.</p><form class="stack" data-forgot-form><div class="field"><label for="forgot-email">E-mail</label><input id="forgot-email" name="email" type="email" autocomplete="username" required></div><div data-feedback></div><button class="btn btn-primary btn-block" type="submit">Enviar link</button></form><button class="link-button" type="button" data-back>Voltar para o login</button>`);
  const form = root.querySelector('[data-forgot-form]');
  form.email.value = email || '';
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    withBusy(form, async () => {
      const feedback = form.querySelector('[data-feedback]');
      try {
        await sessionRepository.requestPasswordReset(form.email.value.trim());
        feedback.innerHTML = alertBox('Se o e-mail estiver cadastrado, você receberá o link em instantes.', 'success');
      } catch (error) {
        feedback.innerHTML = alertBox(errorMessage(error));
      }
    });
  });
  root.querySelector('[data-back]').addEventListener('click', () => renderLogin(root, { onSignedIn }));
}

export function renderNewPassword(root, { onDone, invite = false }) {
  root.innerHTML = authShell(`<h1>${invite ? 'Bem-vindo(a)! Crie sua senha' : 'Nova senha'}</h1>${invite ? '<p class="muted">Defina a senha que você vai usar para entrar no painel.</p>' : ''}<form class="stack" data-new-password><div class="field"><label for="new-password">Nova senha (mínimo 8 caracteres)</label><input id="new-password" name="password" type="password" autocomplete="new-password" minlength="8" required></div><div class="field"><label for="new-password-confirm">Repita a nova senha</label><input id="new-password-confirm" name="confirm" type="password" autocomplete="new-password" minlength="8" required></div><div data-feedback></div><button class="btn btn-primary btn-block" type="submit">Salvar senha</button></form>`);
  const form = root.querySelector('[data-new-password]');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const feedback = form.querySelector('[data-feedback]');
    if (form.password.value !== form.confirm.value) { feedback.innerHTML = alertBox('As senhas não conferem.'); return; }
    withBusy(form, async () => {
      try {
        await sessionRepository.updatePassword(form.password.value);
        await onDone();
      } catch (error) {
        feedback.innerHTML = alertBox(errorMessage(error));
      }
    });
  });
}

export function renderNoAccess(root, { onSignOut }) {
  root.innerHTML = authShell(`<h1>Acesso não liberado</h1><p class="muted">Seu usuário ainda não está vinculado a uma imobiliária. Fale com o administrador.</p><button class="btn btn-secondary btn-block" type="button" data-sign-out>Sair</button>`);
  root.querySelector('[data-sign-out]').addEventListener('click', onSignOut);
}
