import {requestUrl} from 'obsidian';

const defaultHeaders = {
    'Content-Type': 'application/json',
    'User-Agent': 'obsidian/zotero',
    'Accept': 'application/json',
    'Connection': 'keep-alive',
};
  
const baseOptions = {
    url: 'http://localhost:23119/better-bibtex/json-rpc',
    hostname: 'localhost',
    port: 23119,
    path: '/better-bibtex/json-rpc',
    method: 'POST',
    contentType: 'application/json',
    headers: defaultHeaders
};

async function makeJsonRpcHttpRequest(options, data) {
    const body = {'body': data}
    const requestOptions = Object.assign({ ...options }, body)
    const req = await requestUrl(requestOptions);
    const reqJson = req.json;
    if (reqJson['result'][0] == '200' && reqJson['result'][1] == 'text/plain'){
        const resultStr = reqJson.result[2];
	    const resultJson = JSON.parse(resultStr);
        return resultJson
    } else if ('jsonrpc' in reqJson && req.status == 200){
        const resultJson = reqJson['result'];
        return resultJson
    };
}

async function makeHttpRequest(options, data) {
    const body = {'body': data}
    const requestOptions = Object.assign({ ...options }, body)
    const req = await requestUrl(requestOptions);
    return req.text;
}


export async function locateCollection(collectionPath) {
    const jsonRpcData = {
        jsonrpc: "2.0",
        method: "user.groups",
        params: [true]
    };

    const result = await makeJsonRpcHttpRequest(baseOptions, JSON.stringify(jsonRpcData));

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
        url: url,
		hostname: 'localhost',
		port: 23119,
		path: url_path,
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
			},
	};

    try { 
        
        const responseStr = await makeHttpRequest(options, '')

        const responseJson = JSON.parse(responseStr);

        return responseJson;

    }
    catch (error) {
        throw error;
    }


}

export async function bibliography(citeKeys, format) {
    try { 
        
        const jsonRpcData = {
            jsonrpc: "2.0",
            method: "item.bibliography",
            params: [citeKeys, format]
        };

        const result = await makeJsonRpcHttpRequest(baseOptions, JSON.stringify(jsonRpcData));

        return result;

    }
    catch (error) {
        throw error;
    }

}

export async function exportItems(citeKeys, translator, libraryID) {

    try { 
        
        const jsonRpcData = {
            jsonrpc: "2.0",
            method: "item.export",
            params: [citeKeys, translator, libraryID]
        };
    
        const result = await makeJsonRpcHttpRequest(baseOptions, JSON.stringify(jsonRpcData));
        
        return result;

    }
    catch (error) {
        console.error('Error:', error);
        throw error;
    }
        
}

export async function attachments(citeKey) {
    try {

        const jsonRpcData = {
            jsonrpc: "2.0",
            method: "item.attachments",
            params: [citeKey]
        };

        const result = await makeJsonRpcHttpRequest(baseOptions, JSON.stringify(jsonRpcData));

        return result;
	
    } catch (error) {
        throw error;
    }

}

export async function exportCollectionPath(collectionPath, bibFormat = 'betterbibtex') {
    try {
        const coll = await locateCollection(collectionPath)
        const exported_collection = await exportCollection(coll.collectionId, coll.libraryId, bibFormat);
		return exported_collection;
	} catch (error) {
        throw error;
    }
}

export async function collectionCitekeys(collectionPath) {
    try {
        const resultJson = await exportCollectionPath(collectionPath, "json");
        return resultJson.map(item => item.id);
    } catch (error) {
        throw error;
    }
}

export async function collectionCitekeysTitles(collectionPath) {
    try {
        const resultJson = await exportCollectionPath(collectionPath, "json");
        const result_keys_title = resultJson.map(item => {return {'id': item.id, 'title': item.title} });
	    return result_keys_title;
    } catch (error) {
        throw error;
    } 
}
