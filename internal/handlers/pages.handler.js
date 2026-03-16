const fs = require("fs")
const path = require("path")
const {sendHtmlFile, sendText} = require("../utils/http")

const templatesDir = path.join(__dirname, "../../web/templates")
const webDir = path.join(__dirname, "../../web")

const mimeTypes = {
    ".css": "text/css",
    ".js": "application/javascript",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".html": "text/html",
}

function renderTemplate(res, templateName) {
    const filePath = path.join(templatesDir, templateName)
    sendHtmlFile(res, filePath)
}

function showHome(req, res) {
    renderTemplate(res, "index.html")
}

function showDetail(req, res) {
    renderTemplate(res, "detail.html")
}

function showLogin(req, res) {
    renderTemplate(res, "login.html")
}

function showRegister(req, res) {
    renderTemplate(res, "register.html")
}

function showUserInfo(req, res) {
    renderTemplate(res, "userinfo.html")
}

function serveStatic(req, res) {
    const filePath = path.join(webDir, req.url)
    const normalizedWebDir = path.resolve(webDir)
    const normalizedFilePath = path.resolve(filePath)

    if (!normalizedFilePath.startsWith(normalizedWebDir)) {
        sendText(res, 403, "Acces interdit")
        return
    }

    const ext = path.extname(normalizedFilePath).toLowerCase()
    const contentType = mimeTypes[ext] || "application/octet-stream"

    fs.readFile(normalizedFilePath, (err, data) => {
        if (err) {
            sendText(res, 404, "Fichier statique introuvable")
            return
        }

        res.writeHead(200, {"Content-Type": contentType})
        res.end(data)
    })
}

module.exports = {
    showHome,
    showDetail,
    showLogin,
    showRegister,
    showUserInfo,
    serveStatic,
    renderTemplate,
}
