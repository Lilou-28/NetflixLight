const bcrypt = require("bcrypt")
const saltRounds = 10

const hashPassword = async (plainPassword) => {
    try{
        const salt = await bcrypt.genSalt(saltRounds)
        const hashedPassword = await bcrypt.hash(plainPassword, salt)
        return hashedPassword
    }catch(err){
        console.error("Error hashing password:", err)
        throw err
    }
}

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