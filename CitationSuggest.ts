import {
	App,
	Editor,
	EditorPosition,
	EditorSuggest,
	EditorSuggestContext,
	EditorSuggestTriggerInfo,
	MarkdownView,
	TFile,
	request,
	requestUrl
} from 'obsidian';

import BibcitePlugin from 'main';
//import {exportCollection, exportCollectionPath, collectionCitekeys, locateCollection} from 'ZoteroFunctions.js';

interface Suggestion {
	query: string;
	startIndex: number;
	label: string;
}


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

async function locateCollection(collectionPath) {
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


async function exportCollection(collectionId, libraryId, bibFormat = 'betterbibtex') {

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

async function attachments(citeKey) {

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

	return responseJson;

}

async function exportCollectionPath(collectionPath, bibFormat = 'betterbibtex') {
    try {
        const coll = await locateCollection(collectionPath)
        const exported_collection = await exportCollection(coll.collectionId, coll.libraryId, bibFormat);
		return exported_collection;

	} catch (error) {
        console.error('Error:', error);
    }
}

async function collectionCitekeys(collectionPath) {
    const resultJson = await exportCollectionPath(collectionPath, "json");
    return resultJson.map(item => item.id);
}

async function collectionCitekeysTitles(collectionPath) {
    const resultJson = await exportCollectionPath(collectionPath, "json");
    const result_keys_title = resultJson.map(item => {return {'id': item.id, 'title': item.title} });
	return result_keys_title;
}

export class CitationSuggest extends EditorSuggest<Suggestion> {
	private plugin: BibcitePlugin;
	private readonly app: App;
	private justCompleted: boolean;
	private zotero_collection: string;

	constructor(app: App, plugin: BibcitePlugin) {
		super(app);
		this.app = app;
		this.plugin = plugin;
		this.justCompleted = false;
	}
	onTrigger(
		cursor: EditorPosition,
		editor: Editor,
		file: TFile
	): EditorSuggestTriggerInfo | null {

		if (this.justCompleted) {
			this.justCompleted = false;
			return null;
		}


        const triggerPhrase = '@';
        const startPos = this.context?.start || {
			line: cursor.line,
			ch: cursor.ch - triggerPhrase.length,
		};

		const lineToCursor = editor.getRange({line: startPos.line, ch: 0},
											  {line: startPos.line, ch: cursor.ch});

		if (lineToCursor.lastIndexOf("[") == -1) {
			return null;
		} else {
			if (lineToCursor.lastIndexOf("[") < lineToCursor.lastIndexOf("]")){
				return null;
			} else {

			};
		}

		const OpenBracketToCursor = lineToCursor.substring(lineToCursor.lastIndexOf("[")+1)

		const precedingChar = editor.getRange({line: startPos.line, ch: cursor.ch - 1},
											  {line: startPos.line, ch: cursor.ch});

		const followingChar = editor.getRange({line: startPos.line, ch: cursor.ch},
											  {line: startPos.line, ch: cursor.ch + 1});


		if (!OpenBracketToCursor.startsWith("@")) {
			return null;
		}

		if ((precedingChar == " ") || (precedingChar == ";")) {
			return null;
		}

		const LastAtSignToCursor = OpenBracketToCursor.substring(OpenBracketToCursor.lastIndexOf("@")+1)
		console.log(LastAtSignToCursor);

		const LastAtSignLinePos = lineToCursor.lastIndexOf("@");

		const queryStartPos = this.context?.start || {
			line: cursor.line,
			ch: LastAtSignLinePos,
		};

		const noteFile = file;
		const frontMatter = this.app.metadataCache.getFileCache(noteFile).frontmatter;

		this.zotero_collection = frontMatter.zotero_collection

		const query = LastAtSignToCursor;

		console.log({
            start: queryStartPos,
            end: cursor,
            query: query,
            })

        return {
            start: queryStartPos,
            end: cursor,
            query: query,
            };

    }

	async getSuggestions(context: EditorSuggestContext): Suggestion[] {

		const suggestions = await collectionCitekeysTitles(this.zotero_collection)

        if (suggestions.length) {
            return suggestions.filter(
						(item) => item['id'].startsWith(context.query)
					);
        }

        // catch-all if there are no matches
        return [{ label: context.query }];
    }

	renderSuggestion(suggestion: Suggestion, el: HTMLElement): void {
		el.setText('@' + suggestion['id']);
		el.innerHTML += '<br>';
		el.append(suggestion['title']);
	}

	selectSuggestion(suggestion: Suggestion, event: KeyboardEvent | MouseEvent): void {
		const { editor } = this.context;

		const precedingChar = editor.getRange({line: this.context.start.line, ch: this.context.start.ch - 1},
											  {line: this.context.start.line, ch: this.context.start.ch});

		const followingChar = editor.getRange({line: this.context.start.line, ch: this.context.end.ch},
											  {line: this.context.start.line, ch: this.context.end.ch + 1});


		const suggStr = '@' + suggestion.id ;

		let cursorEndPos = null;

		if (followingChar == ']'){
			cursorEndPos = this.context.start.ch + suggStr.length + 1
		} else {
			cursorEndPos = this.context.start.ch + suggStr.length
		}

		editor.replaceRange(suggStr, this.context.start, {'line': this.context.end.line, 'ch': this.context.end.ch });

		editor.setCursor({'line': this.context.start.line, 'ch': cursorEndPos})

		this.justCompleted = true;

	}

}
