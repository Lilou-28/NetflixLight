const http = require('http')
const {routeRequest} = require("../internal/routes")

const host = 'localhost'
const port = 8080

const server = http.createServer(routeRequest)

server.listen(port, host, () => {
    console.log(`Server is running on http://${host}:${port}`)
})