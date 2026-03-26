const searchForm = document.getElementById("search-form");
const searchInput = document.getElementById("search-input");

let debounceTimer;

searchForm.addEventListener("submit", function(e) {
    e.preventDefault();
    const query = searchInput.value.trim();

    clearTimeout(debounceTimer);
    if (query.length < 3) return;

    debounceTimer = setTimeout(() => {
        performSearch(query);
    }, 300);
});

async function performSearch(query) {
    try {
        const response = await fetch(`/search-movie?query=${encodeURIComponent(query)}`);
        const data = await response.json();
        console.log(data);
        // TODO: afficher les résultats dans la page
    } catch (err) {
        console.error("Erreur recherche:", err);
    }
}