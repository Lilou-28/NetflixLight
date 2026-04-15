const isSecureCookie = process.env.NODE_ENV === "production"

function getSessionCookie(token, maxAgeSeconds = 7200) {
    return [
        `session_token=${encodeURIComponent(token)}`,
        "Path=/", // valide pour tout le site
        `Max-Age=${maxAgeSeconds}`,
        "SameSite=Lax",// protege les requetes d'autres sites
        "HttpOnly",// js ne peux pas lire le cookie
        isSecureCookie ? "Secure" : "",// en production, le cookie ne sera envoyé que sur HTTPS
    ].filter(Boolean).join("; ")
}
// Cookie pour supprimer la session côté client
function getExpiredSessionCookie() {
    return [
        "session_token=",
        "Path=/",
        "Max-Age=0",
        "SameSite=Lax",
        "HttpOnly",
        isSecureCookie ? "Secure" : "",
    ].filter(Boolean).join("; ")
}

module.exports = {
    getSessionCookie,
    getExpiredSessionCookie,
    isSecureCookie,
}
