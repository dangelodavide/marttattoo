import { supabase } from "./supabase.js";

const tbody = document.querySelector("#bookingsTable tbody");
const logoutBtn = document.getElementById("logoutBtn");

// Protezione: se non loggato → torna al login
supabase.auth.getSession().then(({ data }) => {
  if (!data.session) {
    window.location.href = "../backoffice/login.html";
  }
});

logoutBtn?.addEventListener("click", async () => {
  await supabase.auth.signOut();
  window.location.href = "../backoffice/login.html";
});

async function loadBookings() {
  if (!tbody) return;

  const { data, error } = await supabase
    .from("appointments")
    .select("*")
    .order("date", { ascending: true })
    .order("slot", { ascending: true });

  if (error) {
    console.error(error);
    tbody.innerHTML = `<tr><td colspan="7">Errore nel caricamento.</td></tr>`;
    return;
  }

  if (!data || !data.length) {
    tbody.innerHTML = `<tr><td colspan="7">Nessuna prenotazione trovata.</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(row => `
    <tr>
      <td style="padding:8px; border-bottom:1px solid var(--border);">${row.date}</td>
      <td style="padding:8px; border-bottom:1px solid var(--border);">${row.slot}</td>
      <td style="padding:8px; border-bottom:1px solid var(--border);">${row.name}</td>
      <td style="padding:8px; border-bottom:1px solid var(--border);">${row.phone}</td>
      <td style="padding:8px; border-bottom:1px solid var(--border);">${row.style || ""}</td>
      <td style="padding:8px; border-bottom:1px solid var(--border); max-width:260px;">${row.notes || ""}</td>
      <td style="padding:8px; border-bottom:1px solid var(--border);">
        ${row.created_at ? new Date(row.created_at).toLocaleString("it-IT") : ""}
      </td>
    </tr>
  `).join("");
}

loadBookings();
