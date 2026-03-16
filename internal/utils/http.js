const fs = require("fs")

function sendText(res, statusCode, text) {
    res.writeHead(statusCode, {"Content-Type": "text/plain; charset=utf-8"})
    res.end(text)
}

function sendHtmlFile(res, filePath, statusCode = 200) {
    fs.readFile(filePath, (err, data) => {
        if (err) {
            sendText(res, 500, "Erreur serveur")
            return
        }

        res.writeHead(statusCode, {"Content-Type": "text/html; charset=utf-8"})
        res.end(data)
    })
}

function parseFormBody(req, callback) {
    let body = ""

    req.on("data", (chunk) => {
        body += chunk.toString()
    })

    req.on("end", () => {
        callback(null, new URLSearchParams(body))
    })

    req.on("error", (err) => {
        callback(err)
    })
}

module.exports = {
    sendText,
    sendHtmlFile,
    parseFormBody,
}
