const http = require('http')
const fs = require('fs').promises

const host = 'localhost'
const port = 8080

const server = http.createServer((req, res) => {
    fs.readFile(__dirname + "/../web/templates/index.html")
    .then(contents => {
        res.statusCode = 200
        res.setHeader('Content-Type', 'text/html')
        res.end(contents)
    })
    .catch(err => {
        res.writeHead(500)
        res.end(String(err))
        return
    })
})

server.listen(port, host, () => {
    console.log(`Server is running on http://${host}:${port}`)
})