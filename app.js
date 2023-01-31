const express = require("express")
const helpers = require("./helpers.js")
const uuid = require("uuid")
const fs = require("fs")
const {v4: uuidv4} = require("uuid")

const domain = "pp.blinry.org"
const user = "blinry"

let state = require("./state.json")
let publicKey = fs.readFileSync("./public.pem", "ascii")

const app = express()
const port = 7800

function writeState() {
    require("fs").writeFileSync("./state.json", JSON.stringify(state, null, 4))
}

app.use(express.json({type: "*/*"}))
app.use(express.static("public"))

app.get("/.well-known/webfinger", (req, res) => {
    res.json({
        subject: `acct:${user}@${domain}`,
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
        preferredUsername: user,
        inbox: `https://${domain}/inbox`,
        outbox: `https://${domain}/outbox`,
        followers: `https://${domain}/followers`,
        summary: "Test account on PassivityPub",
        icon: {
            type: "Image",
            mediaType: "image/png",
            url: `https://${domain}/icon.png`,
        },
        publicKey: {
            id: `https://${domain}/actor#main-key`,
            owner: `https://${domain}/actor`,
            publicKeyPem: publicKey,
        },
    })
})

app.get("/followers", (req, res) => {
    handleCollectionRequest(req, res, state.following, "following")
})

app.get("/outbox", (req, res) => {
    handleCollectionRequest(req, res, state.outbox, "outbox")
})

app.get("/object/:id", (req, res) => {
    console.log(req.params.id)
    let object = state.objects[req.params.id]
    console.log(state.objects)
    console.log(object)
    if (object) {
        res.setHeader("Content-Type", "application/activity+json")
        res.json(object)
    } else {
        res.status(404).end()
    }
})

app.post("/inbox", async (req, res) => {
    let thing = req.body
    console.log(thing)
    if (thing.type === "Follow") {
        let inbox = await findInbox(thing.actor)
        helpers.sendSigned(inbox, domain, {
            "@context": "https://www.w3.org/ns/activitystreams",
            id: `https://${domain}/accept/${thing.id}`,
            type: "Accept",
            actor: `https://${domain}/actor`,
            object: thing,
        })
        if (!state.following) {
            state.following = []
        }
        if (!state.following.includes(thing.actor)) {
            state.following.push(thing.actor)
        }
        writeState()
    }
    res.end()
})

app.listen(port, () => {
    console.log(`Listening on port ${port}`)
    //createNote("<p>Hello world! :3</p>")
})

function createNote(text) {
    let note = {
        "@context": "https://www.w3.org/ns/activitystreams",
        id: newId(),
        type: "Note",
        attributedTo: `https://${domain}/actor`,
        published: new Date().toISOString(),
        content: text,
        to: "https://www.w3.org/ns/activitystreams#Public",
    }
    let create = {
        "@context": "https://www.w3.org/ns/activitystreams",
        id: newId(),
        type: "Create",
        actor: `https://${domain}/actor`,
        object: note,
    }
    addObject(note)
    addObject(create)
    addToOutbox(create)
}

async function findInbox(actor) {
    let json = await helpers.fetchJSON(actor)
    return json.inbox
}

function handleCollectionRequest(req, res, collection, name) {
    let response = {
        "@context": "https://www.w3.org/ns/activitystreams",
        totalItems: collection.length,
    }

    if (req.query.page) {
        let page = parseInt(req.query.page)
        let start = (page - 1) * 10
        let end = start + 10
        let items = collection.slice(start, end)
        response.id = `https://${domain}/${name}?page=${page}`
        response.type = "OrderedCollectionPage"
        response.partOf = `https://${domain}/${name}`
        if (page > 1) {
            response.prev = `https://${domain}/${name}?page=${page - 1}`
        }
        if (end < collection.length) {
            response.next = `https://${domain}/${name}?page=${page + 1}`
        }
        response.orderedItems = items
    } else {
        response.id = `https://${domain}/${name}`
        response.type = "OrderedCollection"
        response.first = `https://${domain}/${name}?page=1`
    }
    res.json(response)
}

function addObject(object) {
    if (!state.objects) {
        state.objects = {}
    }
    const id = object.id.split("/").pop()
    state.objects[id] = object
    writeState()
}

function addToOutbox(object) {
    if (!state.outbox) {
        state.outbox = []
    }
    state.outbox.push(object)
    console.log(object)
    writeState()
}

function newId() {
    return `https://${domain}/object/${uuidv4()}`
}
