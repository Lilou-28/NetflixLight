const DEFAULT_AUTH_CHECK_INTERVAL_MS = 60000
const SESSION_EXPIRED_POPUP_ID = "nl-session-expired-overlay"
const SESSION_EXPIRED_REDIRECT_DELAY_MS = 5000

function removeExistingSessionExpiredPopup() {
    const existingPopup = document.getElementById(SESSION_EXPIRED_POPUP_ID)
    if (existingPopup) {
        existingPopup.remove()
    }

    if (typeof window.__nlSessionExpiredRedirectTimeout === "number") {
        window.clearTimeout(window.__nlSessionExpiredRedirectTimeout)
        window.__nlSessionExpiredRedirectTimeout = null
    }
}

export function showSessionExpiredPopup(loginPath = "/login") {
    if (typeof document === "undefined") {
        if (window.location.pathname !== loginPath) {
            window.location.href = loginPath
        }
        return
    }

    if (document.getElementById(SESSION_EXPIRED_POPUP_ID)) {
        return
    }

    removeExistingSessionExpiredPopup()

    const overlay = document.createElement("div")
    overlay.id = SESSION_EXPIRED_POPUP_ID
    overlay.style.position = "fixed"
    overlay.style.inset = "0"
    overlay.style.zIndex = "99999"
    overlay.style.display = "grid"
    overlay.style.placeItems = "center"
    overlay.style.background = "rgba(10, 12, 18, 0.38)"
    overlay.style.backdropFilter = "blur(8px)"
    overlay.style.webkitBackdropFilter = "blur(8px)"

    const popup = document.createElement("div")
    popup.setAttribute("role", "status")
    popup.setAttribute("aria-live", "assertive")
    popup.style.width = "min(420px, calc(100% - 2rem))"
    popup.style.padding = "20px"
    popup.style.borderRadius = "14px"
    popup.style.background = "linear-gradient(160deg, rgba(22, 24, 38, 0.96), rgba(16, 18, 30, 0.94))"
    popup.style.border = "1px solid rgba(255, 255, 255, 0.16)"
    popup.style.boxShadow = "0 24px 50px rgba(0, 0, 0, 0.45)"
    popup.style.color = "#fff"
    popup.style.textAlign = "left"

    const title = document.createElement("h3")
    title.textContent = "Session expirée"
    title.style.margin = "0 0 10px"
    title.style.fontSize = "1.1rem"
    title.style.letterSpacing = "0.02em"

    const description = document.createElement("p")
    description.textContent = "Votre session a expiré. Veuillez vous reconnecter pour continuer."
    description.style.margin = "0"
    description.style.lineHeight = "1.45"
    description.style.color = "rgba(255, 255, 255, 0.88)"

    popup.appendChild(title)
    popup.appendChild(description)
    overlay.appendChild(popup)
    document.body.appendChild(overlay)

    window.__nlSessionExpiredRedirectTimeout = window.setTimeout(() => {
        removeExistingSessionExpiredPopup()
        window.location.href = loginPath
    }, SESSION_EXPIRED_REDIRECT_DELAY_MS)
}

async function fetchCurrentUser() {
    const response = await fetch("/api/userinfo", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
    })

    if (response.status === 401) {
        return { authenticated: false }
    }

    if (!response.ok) {
        throw new Error(`Erreur de verification de session: ${response.status}`)
    }

    const user = await response.json()
    return { authenticated: true, user }
}

function stopPreviousMonitor() {
    if (typeof window.__nlAuthMonitorCleanup === "function") {
        window.__nlAuthMonitorCleanup()
    }
}

function applyAuthenticatedState(updateHeaderAuth, user) {
    updateHeaderAuth({ isLoggedIn: true, username: user.username })
}

function applyLoggedOutState(updateHeaderAuth) {
    updateHeaderAuth({ isLoggedIn: false })
}

export function startAuthSessionMonitor({
    updateHeaderAuth,
    redirectToLogin = false,
    loginPath = "/login",
    intervalMs = DEFAULT_AUTH_CHECK_INTERVAL_MS,
    onAuthenticated,
    onUnauthenticated,
    onError,
} = {}) {
    if (typeof updateHeaderAuth !== "function") {
        throw new TypeError("updateHeaderAuth est requis pour initialiser le suivi de session")
    }

    stopPreviousMonitor()

    let stopped = false
    let isSyncing = false
    let intervalId = null

    const handleUnauthenticated = () => {
        applyLoggedOutState(updateHeaderAuth)

        if (typeof onUnauthenticated === "function") {
            onUnauthenticated()
        }

        if (redirectToLogin && window.location.pathname !== loginPath) {
            showSessionExpiredPopup(loginPath)
        }
    }

    const syncSession = async () => {
        if (stopped || isSyncing) {
            return
        }

        isSyncing = true

        try {
            const result = await fetchCurrentUser()

            if (stopped) {
                return
            }

            if (result.authenticated) {
                applyAuthenticatedState(updateHeaderAuth, result.user)

                if (typeof onAuthenticated === "function") {
                    onAuthenticated(result.user)
                }

                return
            }

            handleUnauthenticated()
        } catch (error) {
            if (typeof onError === "function") {
                onError(error)
            } else {
                console.error("Erreur lors de la verification de session:", error)
            }
        } finally {
            isSyncing = false
        }
    }

    const syncOnFocus = () => {
        if (!document.hidden) {
            void syncSession()
        }
    }

    document.addEventListener("visibilitychange", syncOnFocus)
    window.addEventListener("focus", syncOnFocus)
    intervalId = window.setInterval(() => {
        void syncSession()
    }, intervalMs)

    void syncSession()

    const cleanup = () => {
        if (stopped) {
            return
        }

        stopped = true

        if (intervalId !== null) {
            window.clearInterval(intervalId)
        }

        document.removeEventListener("visibilitychange", syncOnFocus)
        window.removeEventListener("focus", syncOnFocus)
    }

    window.__nlAuthMonitorCleanup = cleanup

    return cleanup
}
