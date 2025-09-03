(function () {
  // Detect se siamo su GitHub Pages (URL contiene "github.io")
  const isGithub = location.hostname.includes("github.io");

  // Crea il tag <base>
  const base = document.createElement("base");
  base.href = isGithub
    ? "https://dangelodavide.github.io/marttattoo/" // GitHub Pages
    : "/"; // Netlify o hosting in root

  // Inserisci il base come primo elemento nell’head
  document.head.prepend(base);
})();
