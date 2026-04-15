const bcrypt = require("bcrypt")
const saltRounds = 10
// Fonction pour hasher un mot de passe en utilisant bcrypt
const hashPassword = async (plainPassword) => {
    try{
        const salt = await bcrypt.genSalt(saltRounds) // Générer un salt avec le nombre de rounds spécifié
        const hashedPassword = await bcrypt.hash(plainPassword, salt) // Hasher le mot de passe en utilisant le salt généré
        return hashedPassword
    }catch(err){
        console.error("Error hashing password:", err)
        throw err
    }
}
// Fonction pour vérifier un mot de passe en le comparant avec un hash stocké
const verifyPassword = async (plainPassword, hashedPassword) => {
    try{
        const match = await bcrypt.compare(plainPassword, hashedPassword)
        if (match) {
            return true
        } else {
            return false
        }
    }catch(err){
        console.error("Error verifying password:", err)
        throw err
    }
}

module.exports = {
    hashPassword,
    verifyPassword
}