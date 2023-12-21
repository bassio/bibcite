const http = require('http');

function makeHttpRequest(options, data) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let responseData = '';

            res.on('data', (chunk) => {
                responseData += chunk;
            });

            res.on('end', () => {
                resolve(responseData);
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        if (data) {
            req.write(data);
        }

        req.end();
    });
}

export async function locateCollection(collectionPath) {
    const jsonRpcData = {
        jsonrpc: "2.0",
        method: "user.groups",
        params: [true]
    };

    const options = {
        hostname: 'localhost',
        port: 23119,
        path: '/better-bibtex/json-rpc',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
			'Content-Length': JSON.stringify(jsonRpcData).length
        },
    };

    const responseStr = await makeHttpRequest(options, JSON.stringify(jsonRpcData));
	const responseJson = JSON.parse(responseStr);
    const result = responseJson.result;


    const plist = collectionPath.split("/");
    const lib = plist[0];
    const after = plist.slice(1);

    const libNames = result.map(l => l.name);
    const libIds = result.map(l => l.id);

    const matchedLib = result[libNames.indexOf(lib)];
    const matchedLibId = libIds[libNames.indexOf(lib)];

    const allCollections = matchedLib.collections;
    const allCollectionsDict = {};
    allCollections.forEach(c => {
        allCollectionsDict[c.key] = { ...c, children: [] };
    });

    const topCollections = allCollections.filter(c => !c.parentCollection);
    const topCollectionsDict = {};
    topCollections.forEach(c => {
        topCollectionsDict[c.key] = { ...c, children: [] };
    });

    const nonTopCollections = matchedLib.collections.filter(c => c.parentCollection !== false);

    for (const coll of nonTopCollections) {
        if (coll.parentCollection in topCollectionsDict) {
            topCollectionsDict[coll.parentCollection].children.push(coll);
        }
    }

    const matchedTopCollection = topCollections.find(c => c.name === after[0]);
    const matchedTopCollectionKey = matchedTopCollection.key;


    let children = Object.values(allCollectionsDict).filter(c => c.parentCollection === matchedTopCollectionKey);
    let matchedChildCollectionKey = null;


    for (const cname of after.slice(1)) {
        if (matchedChildCollectionKey) {
            children = Object.values(allCollectionsDict).filter(c => c.parentCollection === matchedChildCollectionKey);
        }

        for (const child of children) {

			if (cname === child.name) {
                matchedChildCollectionKey = child.key;
                break;
            }
        }
    }

    return { libraryId: matchedLibId, collectionId: matchedChildCollectionKey };
}


export async function exportCollection(collectionId, libraryId, bibFormat = 'betterbibtex') {

	const url_path = `/better-bibtex/collection?/${libraryId}/${collectionId}.${bibFormat}`;

    const url = `http://127.0.0.1:23119/better-bibtex/collection?/${libraryId}/${collectionId}.${bibFormat}`;

	const options = {
		hostname: 'localhost',
		port: 23119,
		path: url_path,
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
			},
	};

    const responseStr = await makeHttpRequest(options)

	const responseJson = JSON.parse(responseStr);

	return responseJson;

}

export async function bibliography(citeKeys, format) {

    const jsonRpcData = {
        jsonrpc: "2.0",
        method: "item.export",
        params: [citeKeys, format]
    };

    const options = {
        hostname: 'localhost',
        port: 23119,
        path: '/better-bibtex/json-rpc',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
			'Content-Length': JSON.stringify(jsonRpcData).length
        },
    };

    const responseStr = await makeHttpRequest(options, JSON.stringify(jsonRpcData));
	const responseJson = JSON.parse(responseStr);
    const result = responseJson.result;

	return result[2];

}

export async function exportItems(citeKeys, translator, libraryID) {

    const jsonRpcData = {
        jsonrpc: "2.0",
        method: "item.export",
        params: [citeKeys, translator, libraryID]
    };

    const options = {
        hostname: 'localhost',
        port: 23119,
        path: '/better-bibtex/json-rpc',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
			'Content-Length': JSON.stringify(jsonRpcData).length
        },
    };

    const responseStr = await makeHttpRequest(options, JSON.stringify(jsonRpcData));
	const responseJson = JSON.parse(responseStr);
    const result = responseJson.result;
    try { 
	    return result[2];
    }
    catch {
        return "[]";
    }
        
}

export async function attachments(citeKey) {

    const jsonRpcData = {
        jsonrpc: "2.0",
        method: "item.attachments",
        params: [citeKey]
    };

    const options = {
        hostname: 'localhost',
        port: 23119,
        path: '/better-bibtex/json-rpc',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
			'Content-Length': JSON.stringify(jsonRpcData).length
        },
    };

    const responseStr = await makeHttpRequest(options, JSON.stringify(jsonRpcData));

	const responseJson = JSON.parse(responseStr);

	return responseJson.result;

}

export async function exportCollectionPath(collectionPath, bibFormat = 'betterbibtex') {
    try {
        const coll = await locateCollection(collectionPath)
        const exported_collection = await exportCollection(coll.collectionId, coll.libraryId, bibFormat);
		return exported_collection;

	} catch (error) {
        console.error('Error:', error);
    }
}

export async function collectionCitekeys(collectionPath) {
    const resultJson = await exportCollectionPath(collectionPath, "json");
    return resultJson.map(item => item.id);
}

export async function collectionCitekeysTitles(collectionPath) {
    const resultJson = await exportCollectionPath(collectionPath, "json");
    const result_keys_title = resultJson.map(item => {return {'id': item.id, 'title': item.title} });
	return result_keys_title;
}
