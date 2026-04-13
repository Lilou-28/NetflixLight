async function getFavoris() {
    try {
        const res = await fetch("/api/favoris", { credentials: "same-origin" });
        if (!res.ok) return [];
        return await res.json();
    } catch {
        return [];
    }
}

async function addFavori(media_id, media_type, title, poster_path) {
    try {
        const res = await fetch("/api/favoris", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ media_id, media_type, title, poster_path })
        });
        return res.ok;
    } catch {
        return false;
    }
}

async function removeFavori(media_id) {
    try {
        const res = await fetch(`/api/favoris/${media_id}`, {
            method: "DELETE",
            credentials: "same-origin"
        });
        return res.ok;
    } catch {
        return false;
    }
}

async function isFavori(media_id) {
    const favoris = await getFavoris();
    return favoris.some(f => f.media_id == media_id);
}

async function toggleFavori(media_id, media_type, title, poster_path, btn) {
    const already = await isFavori(media_id);
    if (already) {
        await removeFavori(media_id);
        btn.textContent = "♡ Ajouter aux favoris";
        btn.classList.remove("favori--active");
    } else {
        await addFavori(media_id, media_type, title, poster_path);
        btn.textContent = "♥ Retirer des favoris";
        btn.classList.add("favori--active");
    }
}

window.getFavoris = getFavoris;
window.addFavori = addFavori;
window.removeFavori = removeFavori;
window.isFavori = isFavori;
window.toggleFavori = toggleFavori;