const pagesHandler = require("./handlers/pages.handler")
const authHandler = require("./handlers/auth.handler")
const {sendText} = require("./utils/http")

function routeRequest(req, res) {
    if (req.method === "GET" && req.url === "/") {
        pagesHandler.showHome(req, res)
        return
    }

    if (req.method === "GET" && req.url === "/details") {
        pagesHandler.showDetail(req, res)
        return
    }

    if (req.method === "GET" && req.url === "/login") {
        pagesHandler.showLogin(req, res)
        return
    }

    if (req.method === "POST" && req.url === "/login") {
        authHandler.login(req, res)
        return
    }

    if (req.method === "GET" && req.url === "/register") {
        pagesHandler.showRegister(req, res)
        return
    }

    if (req.method === "POST" && req.url === "/register") {
        authHandler.register(req, res)
        return
    }

    if (req.method === "GET" && req.url === "/userinfo") {
        pagesHandler.showUserInfo(req, res)
        return
    }

    if (req.url && req.url.startsWith("/static/")) {
        pagesHandler.serveStatic(req, res)
        return
    }

    sendText(res, 404, "Page non trouvee")
}

module.exports = {
    routeRequest,
}
