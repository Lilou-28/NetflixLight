const fs = require('fs')
const path = require('path')
const { getExpiredSessionCookie } = require('./cookies')
// pour afficher les dates dans la base de donnees corectement
function formatLocalDateTime(date) {
    const pad = (value) => String(value).padStart(2, "0")
    return [
        date.getFullYear(),
        pad(date.getMonth() + 1),
        pad(date.getDate()),
    ].join("-") + ` ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}
//redirecte vers la page de login en supprimant la session
function clearSessionAndRedirectToLogin(res) {
    res.writeHead(302, {
        "Set-Cookie": getExpiredSessionCookie(),
        "Location": "/login?session_expired=1",
    })
    res.end()
}
//supprime la session et envoie une réponse 401 (Non autorisé)
function clearSessionAndSendUnauthorized(res, message = "Session invalide") {
    res.writeHead(401, {
        "Content-Type": "application/json",
        "Set-Cookie": getExpiredSessionCookie(),
    })
    res.end(JSON.stringify({ error: message }))
}
// Fonction générique pour servir une page d'erreur personnalisée (404 ou 500)
function serveErrorPage(res, statusCode, templatePath) {
    fs.readFile(path.join(__dirname, templatePath), "utf8", (err, data) => {
        if (err) {
            res.writeHead(statusCode, { "Content-Type": "text/plain" });
            res.end(statusCode === 404 ? "Page non trouvée" : "Erreur serveur");
            return;
        }
        res.writeHead(statusCode, { "Content-Type": "text/html" });
        res.end(data);
    });
}
// fonction pour afficher une page 404/500 personnalisée
function serve404(res) {
    serveErrorPage(res, 404, "../web/templates/404.html");
}

function serve500(res) {
    serveErrorPage(res, 500, "../web/templates/500.html");
}

module.exports = {
    formatLocalDateTime,
    clearSessionAndRedirectToLogin,
    clearSessionAndSendUnauthorized,
    serveErrorPage,
    serve404,
    serve500,
}
