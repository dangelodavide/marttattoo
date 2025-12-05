import { supabase } from "./supabase.js";

const form = document.getElementById("loginForm");
const msg  = document.getElementById("loginMsg");

// Se già loggato → vai direttamente alla dashboard
supabase.auth.getSession().then(({ data }) => {
  if (data.session) {
    window.location.href = "../backoffice/dashboard.html";
  }
});

if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.textContent = "";

    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value.trim();

    if (!email || !password) {
      msg.textContent = "Inserisci email e password.";
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      console.error(error);
      msg.textContent = "Credenziali non valide.";
      return;
    }

    window.location.href = "../backoffice/dashboard.html";
  });
}
