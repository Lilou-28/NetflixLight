const path = require("path")
const db = require("../database")
const {parseFormBody, sendText, sendHtmlFile} = require("../utils/http")

const indexTemplatePath = path.join(__dirname, "../../web/templates/index.html")

function login(req, res) {
    parseFormBody(req, (parseErr, params) => {
        if (parseErr) {
            sendText(res, 400, "Requete invalide")
            return
        }

        const username = params.get("username")
        const password = params.get("password")

        const query = "SELECT * FROM users WHERE username = ? AND password = ?"
        db.get(query, [username, password], (err, row) => {
            if (err) {
                sendText(res, 500, "Erreur lors de la connexion")
                return
            }

            if (!row) {
                sendText(res, 401, "Nom d'utilisateur ou mot de passe incorrect")
                return
            }

            sendHtmlFile(res, indexTemplatePath)
        })
    })
}

function register(req, res) {
    parseFormBody(req, (parseErr, params) => {
        if (parseErr) {
            sendText(res, 400, "Requete invalide")
            return
        }

        const name = params.get("name")
        const email = params.get("email")
        const username = params.get("username")
        const password = params.get("password")
        const confirmPassword = params.get("confirm_password")

        if (password !== confirmPassword) {
            sendText(res, 400, "Les mots de passe ne correspondent pas")
            return
        }

        db.registerUser(name, email, username, password, (err) => {
            if (err) {
                if (err.message.includes("UNIQUE constraint failed")) {
                    sendText(res, 409, "Email ou nom d'utilisateur deja utilise")
                    return
                }

                sendText(res, 500, "Erreur lors de l'inscription")
                return
            }

            sendHtmlFile(res, indexTemplatePath)
        })
    })
}

module.exports = {
    login,
    register,
}
