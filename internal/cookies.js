const isSecureCookie = process.env.NODE_ENV === "production"

function getSessionCookie(token, maxAgeSeconds = 7200) {
    return [
        `session_token=${encodeURIComponent(token)}`,
        "Path=/",
        `Max-Age=${maxAgeSeconds}`,
        "SameSite=Lax",
        "HttpOnly",
        isSecureCookie ? "Secure" : "",
    ].filter(Boolean).join("; ")
}

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
