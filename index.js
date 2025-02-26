const fetch = require("node-fetch");
const express = require('express');
const app = express();
const port = process.env.PORT || 5000;

const { CardCreator } = require('./create-card');

const creator = new CardCreator();

// node cachemanager
var cacheManager = require('cache-manager');
// storage for the cachemanager
var fsStore = require('cache-manager-fs-binary');
// initialize caching on disk
var diskCache = cacheManager.caching({
    store: fsStore,
    options: {
        reviveBuffers: true,
        binaryAsStream: false,
        ttl: 60 * 60 * 4 /* seconds */,
        maxsize: 1000 * 1000 * 1000 /* max size in bytes on disk */,
        path: 'diskcache',
        preventfill: true
    }
});

async function getCharIdByName(world, name) {
    var response = await fetch(`https://xivapi.com/character/search?name=${name}&server=${world}`);
    var data = await response.json();

    if (data.Results[0] === undefined)
        return undefined;

    return data.Results[0].ID;
}

app.get('/prepare/id/:charaId', async (req, res) => {
    var cacheKey = `img:${req.params.charaId}`;
    var ttl = 60 * 60 * 4; // 4 hours

    diskCache.wrap(cacheKey,
        // called if the cache misses in order to generate the value to cache
        function (cb) {
            creator.ensureInit().then(() => creator.createCard(req.params.charaId), (reason) => cb('Init failed: ' + reason, null)).then(image => cb(null, {
                binary: {
                    image: image,
                }
            })).catch((reason) => cb('createCard failed: ' + reason, null));
        },
        // Options, see node-cache-manager for more examples
        { ttl: ttl },
        function (err, result) {
            if (err !== null) {
                console.error(err);
                res.status(500).send({status: "error", reason: err});
                return;
            }

            res.status(200).send({status: "ok", url: `/characters/id/${req.params.charaId}.png`});
        }
    );
})

app.get('/prepare/name/:world/:charName', async (req, res) => {
    var id = await getCharIdByName(req.params.world, req.params.charName);

    if (id === undefined) {
        res.status(404).send("Character not found.");
        return;
    }

    res.redirect(`/prepare/id/${id}`);
})

app.get('/characters/id/:charaId.png', async (req, res) => {
    var cacheKey = `img:${req.params.charaId}`;
    var ttl = 60 * 60 * 4; // 4 hours

    diskCache.wrap(cacheKey,
        // called if the cache misses in order to generate the value to cache
        function (cb) {
            creator.ensureInit().then(() => creator.createCard(req.params.charaId), (reason) => cb('Init failed: ' + reason, null)).then(image => cb(null, {
                binary: {
                    image: image,
                }
            })).catch((reason) => cb('createCard failed: ' + reason, null));
        },
        // Options, see node-cache-manager for more examples
        { ttl: ttl },
        function (err, result) {
            if (err !== null) {
                console.error(err);
                res.status(500).send({status: "error", reason: err});
                return;
            }

            var image = result.binary.image;

            res.writeHead(200, {
                'Content-Type': 'image/png',
                'Content-Length': image.length,
                'Cache-Control': 'public, max-age=14400'
            });

            res.end(image, 'binary');

            var usedStreams = ['image'];
            // you have to do the work to close the unused files
            // to prevent file descriptors leak
            for (var key in result.binary) {
                if (!result.binary.hasOwnProperty(key)) continue;
                if (usedStreams.indexOf(key) < 0
                    && result.binary[key] instanceof Stream.Readable) {
                    if (typeof result.binary[key].close === 'function') {
                        result.binary[key].close(); // close the stream (fs has it)
                    } else {
                        result.binary[key].resume(); // resume to the end and close
                    }
                }
            }
        }
    );
})

app.get('/characters/id/:charaId', async (req, res) => {
    res.redirect(`/characters/id/${req.params.charaId}.png`);
})

app.get('/characters/name/:world/:charName.png', async (req, res) => {
    var id = await getCharIdByName(req.params.world, req.params.charName);

    if (id === undefined) {
        res.status(404).send("Character not found.");
        return;
    }

    res.redirect(`/characters/id/${id}.png`);
})

app.get('/characters/name/:world/:charName', async (req, res) => {
    res.redirect(`/characters/name/${req.params.world}/${req.params.charName}.png`);
})

app.get('/', async (req, res) => {
    res.redirect('https://github.com/ArcaneDisgea/XIV-Character-Cards');
})

app.listen(port, () => {
    console.log(`Listening at http://localhost:${port}`)
})