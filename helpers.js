const https = require("https")
const crypto = require("crypto")
const fs = require("fs")

let privateKey = fs.readFileSync("./private.pem", "ascii")

module.exports = {
    // Via https://stackoverflow.com/questions/65306617/async-await-for-node-js-https-get
    fetchJSON: async function (url) {
        return new Promise((resolve) => {
            let data = ""
            https.get(
                url,
                {headers: {Accept: "application/activity+json"}},
                (res) => {
                    res.on("data", (d) => {
                        data += d
                    })
                    res.on("end", () => {
                        resolve(JSON.parse(data))
                    })
                }
            )
        })
    },

    sendSigned: function (url, domain, payload) {
        let domain2 = url.split("/")[2]
        let path = url.split(domain2)[1]
        let options = {
            host: domain2,
            port: 443,
            method: "POST",
            path: path,
            headers: {},
        }
        let req = https.request(options, (res) => {
            console.log(res.statusCode)
            res.on("data", (d) => {
                process.stdout.write(d)
            })
        })
        let date = new Date().toUTCString()
        let digest =
            "SHA-256=" +
            crypto
                .createHash("sha256")
                .update(JSON.stringify(payload))
                .digest("base64")

        let signedString = `(request-target): post ${path}\nhost: ${domain2}\ndate: ${date}\ndigest: ${digest}`
        let signer = crypto.createSign("RSA-SHA256")
        signer.update(signedString)
        signer.end()
        let signature = signer.sign(privateKey)
        let signatureBase64 = signature.toString("base64")
        let header = `keyId="https://${domain}/actor#main-key",algorithm="rsa-sha256",headers="(request-target) host date digest",signature="${signatureBase64}"`
        req.setHeader("Date", date)
        req.setHeader("Digest", digest)
        req.setHeader("Signature", header)
        req.write(JSON.stringify(payload))
        req.end()
    },
}
