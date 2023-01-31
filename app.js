const https = require("https")
const crypto = require("crypto")
const fs = require("fs")
const express = require("express")
const httpSignature = require("http-signature")
const app = express()
const port = 7800

const domain = "pp.blinry.org"
let state = require("./state.json")

function writeState() {
    require("fs").writeFileSync("./state.json", JSON.stringify(state))
}

app.use(express.json({type: "*/*"}))

app.get("/.well-known/webfinger", (req, res) => {
    res.json({
        subject: "acct:blinry@pp.blinry.org",
        links: [
            {
                rel: "self",
                type: "application/activity+json",
                href: `https://${domain}/actor`,
            },
        ],
    })
})

app.get("/actor", (req, res) => {
    res.json({
        "@context": [
            "https://www.w3.org/ns/activitystreams",
            "https://w3id.org/security/v1",
        ],
        id: `https://${domain}/actor`,
        type: "Person",
        preferredUsername: "blinry",
        inbox: `https://${domain}/inbox`,
        followers: `https://${domain}/followers`,
        summary: "Test account on PassivityPub",
        publicKey: {
            id: `https://${domain}/actor#main-key`,
            owner: `https://${domain}/actor`,
            publicKeyPem:
                "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAv47OZbT1+wkXV5Q7JY21\nUeeg02Bg/+e7bVBvMVxls6ywaqz8XMPJi7qiOqVheqRpDarHel8hqLX/gc9yBjo4\nr5Da1gNP6CtF9vkiswZTKpR+t8g1X+BWPMknMTNPXIV+4ufj1zutbvJTiBBhFA5g\nfZ+3sDTNCKqW2hpwWvNL6sMEFl510UhTqHsQbMlAXUMtteQ1vL2rWYHk+DgmiP69\nx/Nm11jrIl0gHgV/zY+ajkUC8D2FZXI58J47o8q3RaIlxL2RPaO1RwPRnsBBWpkf\noRBfLRSZNDJEaels0SPKrbq2cvVa1tEjQ5iSYyNPJ7ZZSx22BDh95GmtULUymAVv\n6wIDAQAB\n-----END PUBLIC KEY-----",
        },
    })
})

app.get("/followers", (req, res) => {
    handleCollectionRequest(req, res, state.following)
})

function handleCollectionRequest(req, res, collection) {
    if (req.query.page) {
        let page = parseInt(req.query.page)
        let start = (page - 1) * 10
        let end = start + 10
        let items = collection.slice(start, end)
        res.json({
            "@context": "https://www.w3.org/ns/activitystreams",
            id: `https://${domain}/followers?page=${page}`,
            type: "OrderedCollectionPage",
            totalItems: collection.length,
            partOf: `https://${domain}/followers`,
            orderedItems: items,
        })
    } else {
        res.json({
            "@context": "https://www.w3.org/ns/activitystreams",
            id: `https://${domain}/followers`,
            type: "OrderedCollection",
            totalItems: collection.length,
            first: `https://${domain}/followers?page=1`,
        })
    }
}

app.post("/inbox", async (req, res) => {
    let thing = req.body
    console.log(thing)
    // headers
    console.log(req.headers)
    if (thing.type === "Follow") {
        let inbox = await findInbox(thing.actor)
        sendSigned(inbox, {
            "@context": "https://www.w3.org/ns/activitystreams",
            id: `https://${domain}/accept/${thing.id}`,
            type: "Accept",
            actor: `https://${domain}/actor`,
            object: thing,
        })
        state.following.push(thing.actor)
        writeState()
    }
    res.end()
})

async function findInbox(actor) {
    // Make GET request to actor
    let json = await fetchJSON(actor)
    return json.inbox
}

function sendSigned(url, payload) {
    console.log(url)
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
    console.log(req.getHeaders())
    let date = new Date().toUTCString()
    let digest =
        "SHA-256=" +
        crypto
            .createHash("sha256")
            .update(JSON.stringify(payload))
            .digest("base64")

    let signedString = `(request-target): post ${path}\nhost: ${domain2}\ndate: ${date}\ndigest: ${digest}`
    console.log(signedString)
    let key = require("fs").readFileSync("./private.pem", "ascii")
    // RSA signature
    //let signature = crypto.sign("sha256", Buffer.from(signedString), {
    //    key: key,
    //    padding: crypto.constants.RSA_PKCS1_PADDING,
    //})
    let signer = crypto.createSign("RSA-SHA256")
    signer.update(signedString)
    signer.end()
    let signature = signer.sign(key)
    let signatureBase64 = signature.toString("base64")
    let header = `keyId="https://${domain}/actor#main-key",algorithm="rsa-sha256",headers="(request-target) host date digest",signature="${signatureBase64}"`
    req.setHeader("Date", date)
    req.setHeader("Digest", digest)
    req.setHeader("Signature", header)
    req.write(JSON.stringify(payload))
    console.log(req.getHeaders())
    req.end()
}

app.listen(port, () => {
    console.log(`Listening on port ${port}`)
    //sendSigned(`https://${domain}/inbox`, {type: "Hello"})
})

// Wat. Via https://stackoverflow.com/questions/65306617/async-await-for-node-js-https-get
async function fetchJSON(url) {
    return new Promise((resolve) => {
        let data = ""
        // Set content type to application/activity+json
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
}
