// remplace les caractères spéciaux par leurs entités HTML correspondantes pour éviter les problèmes d'affichage et de sécurité
function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;")
}

module.exports = {
    escapeHtml,
}
