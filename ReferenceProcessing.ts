import { exportCollectionPath, attachments } from "ZoteroFunctions.ts";


export interface CollectionData {
    library: string;
    bibliography: string[];
    data: Object;
    citations?: string[];
    error?: Error;
}

export interface ItemAnnotationsData {
    citekey: string;
    parentUri: string;
    annotations: Object;
    itemData: Object;
}


export async function processCollection(collectionPath:string):Promise<CollectionData>  {

    try {
        let refs;

        const libraryName = collectionPath.split("/")[0];

        /** const dataJson = await exportCollectionPath(collectionPath, "json");
        const citekeys = dataJson.map(item => item.id);
        const citekeys_unique = new Set(citekeys)
        **/
        
        const dataJzon = await exportCollectionPath(collectionPath, "jzon");
        const dataItems = dataJzon["items"];
        const dataJson = dataItems;
        dataJson.map(item => item.id = item.citationKey)
        const citekeys = dataJson.map(item => item.citationKey);
        const citekeys_unique = new Set(citekeys)

        return {'library': libraryName, 'bibliography': [...citekeys_unique], 'data': dataJson};

    } catch (e) {
        console.error(e);
        return {'library': null, 'bibliography': [], 'data': [], 'error': e};
    }

};



export async function processAttachmentAnnotations(collectionData:CollectionData, bibliographyMode:Boolean=false):Promise<ItemAnnotationsData[]> {

    const allAnnotationsData:ItemAnnotationsData[] = [];

    const referenceEntries = bibliographyMode ? collectionData.bibliography : collectionData.citations;
    
    for (const item of referenceEntries) {
        
      const itemData = collectionData.data.find((i) => i.id == item);

      const itemAttachmentsAll = await attachments(item, collectionData.library)
      
      const itemAttachmentsWithPath = itemAttachmentsAll.filter(attach => attach.path != false)

      if (itemAttachmentsWithPath.length){
        const linkAttachment = itemAttachmentsWithPath[0]['open'];
        const linkAnnotations = itemAttachmentsWithPath[0]['annotations'];

        const data:ItemAnnotationsData = {citekey: item, parentUri: linkAttachment, annotations: linkAnnotations, itemData: itemData};

        allAnnotationsData.push(data);
        
      }

    }

    return allAnnotationsData;

}
