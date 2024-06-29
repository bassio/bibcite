import { ItemView, MarkdownView, WorkspaceLeaf, Modal, Notice, setIcon } from 'obsidian';

import BibcitePlugin from './main';
import { exportItems } from "ZoteroFunctions.ts";
import { ItemAnnotationsData, CollectionData, processCollection, processAttachmentAnnotations } from "ReferenceProcessing.ts";


export const ReferencesViewType = 'ReferencesView';

interface CollectionData {
  library: string;
  bibliography: string[];
  data: Object;
  citations?: string[];
  error?: Error;
}

const fs = require('fs');

const ZoteroFrontmatterEntry = 'zotero_collection'

interface ReferencesViewPersistedState {
  zotero_collection: string;
  libraryName: string;
  citations: string[];
}

export class ReferencesView extends ItemView {
  plugin: BibcitePlugin;
  activeMarkdownLeaf: MarkdownView;
  references: [];

  constructor(leaf: WorkspaceLeaf, plugin: BibcitePlugin) {
    super(leaf);
    this.plugin = plugin;
    this.contentEl.addClass('bibcite-references');
    this.setEmptyView(this.plugin.settings.defaultViewMode == 'bibliography' ? true : false);
    this.addAction("refresh-cw", "Refresh References", () => {
      this.renderReferences();
    })
  }

  setHeader(header: HTMLElement, bibliographyMode=false, annotationsView=false){

    const mode = bibliographyMode ? 'Bibliography' : 'References' 
    const oppositeMode = bibliographyMode ? 'References' : 'Bibliography'
    
    var headerText;

    if (!annotationsView){
      headerText = header.createEl("span", { text: mode, cls: "references-header-text" });
    } else {
      headerText = header.createEl("span", { text: 'Annotations', cls: "references-header-text" });
    }
    
    this.headerText = headerText;

    const refreshButton = header.createEl("button", { text: "Refresh", cls: "refresh-button" , title: "Refresh"});
    setIcon(refreshButton, "refresh-cw");

    const modeButton = header.createEl("button", { text: "Switch References/Bibliography Mode", cls: "mode-button", title: `Switch to ${oppositeMode} mode` });
    setIcon(modeButton, "book-copy");

    const annotationsButton = header.createEl("button", { text: `${mode} Annotations`, cls: "annotations-button", title: `Annotations` });
    setIcon(annotationsButton, "book-open-text");
    annotationsButton.onclick = async (e) => {
      const annotationsMode = this.getAnnotationsViewMode();

      if (annotationsMode == 'modal') {
        const attachmentAnnotations = await processAttachmentAnnotations(this.references, bibliographyMode);
        new MultiAnnotationsModal(this.app, attachmentAnnotations).open();  
      }
      else if (annotationsMode == 'leaf') {
        this.renderAnnotations(bibliographyMode);
      }
    };

    this.annotationsButton = annotationsButton;

    if (!bibliographyMode){
      refreshButton.onclick = (e) => {
        this.renderReferences();
      }
      modeButton.onclick = (e) => {
        this.renderBibliography();
      }
    } else {
      refreshButton.onclick = (e) => {
        this.renderBibliography();
      }
      modeButton.onclick = (e) => {
        this.renderReferences();
      }
    }


  }

  setViewContent(content: HTMLElement, bibliographyMode=false, annotationsView=false) {
    this.contentEl.empty();
    const containerDiv = this.contentEl.createDiv({cls:"container-div" });
    const header = containerDiv.createDiv({cls:"references-header"});

    this.setHeader(header, bibliographyMode, annotationsView);

    if (!content) {
      this.setEmptyView();
    } else {
      this.contentEl.append(content);
    }
  }

  setErrorView(error) {
    this.contentEl.empty();
    const containerDiv = this.contentEl.createDiv({cls:"container-div" });
    const header = containerDiv.createDiv({cls:"references-header"});
    const headerText = header.createEl("span", { text: "References", cls: "references-header-text" });
    this.button = header.createEl("button", { text: "Refresh", cls: "refresh-button" });
    setIcon(this.button, "refresh-cw");
    this.button.onclick = (e) => {
      this.renderReferences();
    }

    if (error.message == 'net::ERR_CONNECTION_REFUSED'){
      containerDiv.createDiv({
        cls: 'pane-empty',
        text: 'Unable to connect to Zotero. Is Zotero running?',
      });
    } else {
      containerDiv.createDiv({
        cls: 'pane-empty',
        text: error.message,
      });
    }
  }

  setEmptyView(bibliographyMode=false) {
    this.contentEl.empty();
    const containerDiv = this.contentEl.createDiv({cls:"container-div" });
    const header = containerDiv.createDiv({cls:"references-header"});

    this.setHeader(header, bibliographyMode);

    if (!bibliographyMode){
      containerDiv.createDiv({
        cls: 'pane-empty',
        text: 'No citations found in the current document.',
      });
    } else {
      containerDiv.createDiv({
        cls: 'pane-empty',
        text: 'No bibliography entries found for the current document.',
      });
    }

  }

  getReferencesViewMode() {
    return this.plugin.settings.defaultViewMode;
  }
  getAnnotationsViewMode() {
    return this.plugin.settings.defaultAnnotationsMode;
  }

  getViewType() {
    return ReferencesViewType;
  }

  getDisplayText() {
    return 'References';
  }

  getIcon() {
    return 'graduation-cap';
  }

  async processReferences() {

    let refs;

    const { settings, view } = this;

		const activeView = this.plugin.app.workspace.getActiveFileView();
		const activeFile = this.plugin.app.workspace.getActiveFile();


		if (activeFile) {

			try {

				const fileContent = await this.plugin.app.vault.cachedRead(activeView.file);
        const cache = this.plugin.app.metadataCache.getFileCache(activeFile);
		    const frontMatter = cache.frontmatter;

        if (!frontMatter){
          const refs:CollectionData = {library: null, citations: [], bibliography: [], data: []};
          this.references = refs;
          return this.references;
        }
        if (!Object.hasOwn(frontMatter, 'zotero_collection')){
          const refs:CollectionData = {library: null, citations: [], bibliography: [], data: []};
          this.references = refs;
          return this.references;
        }
        
        const collectionPath = frontMatter.zotero_collection;

        let refData = await processCollection(collectionPath);

        const libraryName = refData['library'];

        const citekeys = refData['data'].map((item) => item['id']);
        
				const re = /\[(@[a-zA-Z0-9_-]+[ ]*;?[ ]*)+\]/g

				let matches = fileContent.match(re)
        
        if (matches){
          matches = matches.map(item => item.slice(1, -1).split(";").map( i => i.trim().replace("@", "") ));
          matches = matches.flat(1).filter((item) => citekeys.includes(item));
        } else {
          matches = [];
        }
        
        const matches_unique = new Set(matches)
      
        refData['citations'] = [...matches_unique];
        
        this.references = refData;

        return this.references;

			} catch (e) {
				console.error(e);
				refs = {'library': null, 'citations': [], 'bibliography': [], 'data': [], 'error': e};
        this.references = refs;
        return this.references;

			}
		} else {
			refs = {'library': null, 'citations': [], 'bibliography': [], 'data': [], };
      this.references = refs;
      return this.references;

		};
	};

  async renderReferences() {

    const refs = await this.processReferences();
    
    if (refs.citations.length == 0){
      if ('error' in refs) {
        this.setErrorView(refs.error);
      } else {
        this.setEmptyView();
      };
      return
    }

    const containerDiv = document.createElement('div');
    containerDiv.classList.add('references-div');

    const refData = await exportItems(refs.citations, "json", refs.library);
    
    for (const item of refs.citations) {
      const itemDiv = document.createElement('div');
      itemDiv.classList.add('reference-div');

      const itemData = refData.flat(1).filter(r => r['id'] == item)[0];

      itemDiv.innerHTML += `<div class="reference-citekey" data-citekey="${itemData['id']}">@${itemData['id']}</div>`;
      itemDiv.innerHTML += `<div class="reference-title"><a data-citekey="${itemData['id']}" href='#0'>${itemData['title']}</a></div>`;
      
      const journal = itemData['container-title-short'] != '' ? itemData['container-title-short'] : itemData['container-title']

      let issueDate;

      if ('date-parts' in itemData['issued']){
        issueDate = itemData['issued']['date-parts'][0][0] != undefined ? itemData['issued']['date-parts'][0][0] : '';
      } else if ('literal' in itemData['issued']){
        issueDate = itemData['issued']['literal'].split(" ")[0];
      }

      itemDiv.innerHTML += `<div class="reference-journal">${journal} ${issueDate}</div>`;

      containerDiv.appendChild(itemDiv);

    }

  this.setViewContent(containerDiv, false); // bibliographyMode=false

  this.renderAttachments(refs, 'references');

  };

  async renderBibliography() {

    const refs = await this.processReferences();
    
    if (refs.bibliography.length == 0){
      if ('error' in refs) {
        this.setErrorView(refs.error);
      } else {
        this.setEmptyView(true);
      };
      return
    }

    const containerDiv = document.createElement('div');
    containerDiv.classList.add('bibliography-div');

    const refData = await exportItems(refs.bibliography, "json", refs.library);
    
    for (const item of refs.bibliography) {
      const itemDiv = document.createElement('div');
      itemDiv.classList.add('reference-div');

      const itemData = refData.flat(1).filter(r => r['id'] == item)[0];

      itemDiv.innerHTML += `<div class="reference-citekey" data-citekey="${itemData['id']}">@${itemData['id']}</div>`;
      itemDiv.innerHTML += `<div class="reference-title"><a data-citekey="${itemData['id']}" href='#0'>${itemData['title']}</a></div>`;
      
      const journal = itemData['container-title-short'] != '' ? itemData['container-title-short'] : itemData['container-title']

      let issueDate;

      if ('date-parts' in itemData['issued']){
        issueDate = itemData['issued']['date-parts'][0][0] != undefined ? itemData['issued']['date-parts'][0][0] : '';
      } else if ('literal' in itemData['issued']){
        issueDate = itemData['issued']['literal'].split(" ")[0];
      }

      itemDiv.innerHTML += `<div class="reference-journal">${journal} ${issueDate}</div>`;

      containerDiv.appendChild(itemDiv);

    }

    this.setViewContent(containerDiv, true); // bibliographyMode=true

    this.renderAttachments(refs, 'bibliography');
  
  }

  async renderAnnotations(bibliographyMode) {

    const containerDiv = document.createElement('div');
    containerDiv.classList.add('annotations-leaf-div');

    const attachmentAnnotations = await processAttachmentAnnotations(this.references, bibliographyMode);
    const fragment = new MultiAnnotationsModal(this.app, attachmentAnnotations).processContent();

    containerDiv.appendChild(fragment);

    //containerDiv.appendChild(itemDiv);

    this.setViewContent(containerDiv, !bibliographyMode, true);
    
    //this.renderAttachments(refs, 'bibliography');

  };

  async renderAttachments(collectionData, bibliographyMode) {

    const containerDiv = document.createElement('div');
    containerDiv.classList.add('references-div');

    if (bibliographyMode == 'references'){
      const referenceEntries = collectionData.citations;
      const bibliographyMode = false;
    } else {
      const referenceEntries = collectionData.bibliography;
      const bibliographyMode = true;
    }

    const itemAnnotationDataArray:ItemAnnotationsData[] = await processAttachmentAnnotations(collectionData, bibliographyMode);

    for (const itemAnnotationData of itemAnnotationDataArray) {

      const linkDomElement = this.contentEl.querySelector(`.reference-div .reference-title a[data-citekey='${itemAnnotationData.citekey}']`);
      linkDomElement?.setAttribute('href', itemAnnotationData.parentUri);

      if (itemAnnotationData.annotations.length){


        const citeKeyDomElement = this.contentEl.querySelector(`.reference-div .reference-citekey[data-citekey='${itemAnnotationData.citekey}']`);

        let annotationsIcon = document.createElement("span");
        annotationsIcon.addClass("annotations-icon");
        annotationsIcon.setAttribute("title", "Review Annotations");
        setIcon(annotationsIcon, "book-open-text");
        annotationsIcon.onclick = (e) => {
          new AnnotationsModal(this.app, itemAnnotationData).open();
        };
        
        citeKeyDomElement?.appendChild(annotationsIcon);
        
      }

    }

  };

}


export class AnnotationsModal extends Modal {
  private _citekey: string;
  private _parentUri: string;
  private _annotations: Object;

  constructor(app: App, private annotationData: ItemAnnotationsData) {
    super(app);
    this._citekey = annotationData.citekey;
    this._parentUri = annotationData.parentUri;
    this._annotations = annotationData.annotations;
    this._data = annotationData.itemData;
  }

  onOpen() {
    this.renderContent();
  }

  onClose() {
    this.contentEl.empty();
  }

  onSelectReference = (citekey: string) => {
    this.contentEl.empty();
    this.renderContent();
  };

  processContent() {
    const citekey = this._citekey;
    const itemData = this._data;
    const fragment = document.createDocumentFragment();

    fragment.createEl("div", { text: `Annotations of @${citekey}`, cls: 'item-annotations-header' });
    fragment.createEl("div", { text: `${itemData.title}`, cls: 'item-annotations-header-item-title'  });

    for (const annotation of this._annotations) {
      this.renderAnnotation(fragment, annotation);
    }

    return fragment;

  }

  renderContent() {
    const fragment = this.processContent();
    this.contentEl.appendChild(fragment);
  }

  renderEmptyContent(fragment: DocumentFragment) {
    fragment.createEl("p", "There are no annotations associated with this reference.");
  }

  renderAnnotation(fragment: DocumentFragment, annotation: Object){
    const annotationDiv = fragment.createDiv({cls: ["annotation-div", `annotation-${annotation.annotationType}`] });

    if (annotation.annotationType == 'highlight'){
      const annotationSpan = annotationDiv.createEl("span", {text: annotation.annotationText});
      annotationSpan.title = annotation.annotationComment //tooltip
      annotationSpan.style = `background-color: ${annotation.annotationColor}`;
      const annotationUri = this._parentUri + `?annotation=${annotation.key}`
      let linkButton = annotationDiv.createEl("a", {cls: "annotation-link-icon", title: "Open in Zotero"});
      linkButton.href = annotationUri;
      setIcon(linkButton, "external-link");
      let copyButton = annotationDiv.createEl("a", {cls: "annotation-copy-icon", title: "Copy to clipboard"});
      setIcon(copyButton, "clipboard-copy");
      copyButton.onclick = (e) => {
        navigator.clipboard.writeText(`${annotation.annotationText}[@${this._citekey}]\n[Link](${annotationUri})\n`);
        new Notice('Annotation copied to clipboard!', 1000);
        this.close();
      }

    }
    else if (annotation.annotationType == 'image'){
      const annotationImage = annotationDiv.createEl("img", {cls: "annotation-img"});
      const pth = annotation.annotationImagePath;
      const _img = "data:image/png;base64," + fs.readFileSync(pth).toString('base64');
      annotationImage.src = _img;
      const annotationSpan = annotationDiv.createEl("span", {text: annotation.annotationComment});
      let linkButton = annotationSpan.createEl("a", {cls: "annotation-link-icon", title: "Open in Zotero"});
      const annotationUri = this._parentUri + `?annotation=${annotation.key}`
      linkButton.href = annotationUri;
      setIcon(linkButton, "external-link");
      

    }
  }
}


export class MultiAnnotationsModal extends Modal {
  private _data: ItemAnnotationsData[];

  constructor(app: App, private annotationData: ItemAnnotationsData[]) {
    super(app);
    this._data = annotationData.filter((item) => item.annotations.length); //only these that have annotations
  }

  onOpen() {
    this.renderContent();
  }

  onClose() {
    this.contentEl.empty();
  }

  onSelectReference = (citekey: string) => {
    this.contentEl.empty();
    this.renderContent();
  };

  getCitekeys() {
    const citekeys = this._data.map((item) => item['citekey']);
    return citekeys;
  }

  async getReferencesData(){
    const citekeys = this.getCitekeys();
    const refData = await exportItems(citekeys, "json", refs.library);
  }
  
  processContent() {
    const fragment = document.createDocumentFragment();

    const containerDiv = fragment.createEl('div');
    containerDiv.classList.add('annotations-div');

    for (const data:ItemAnnotationsData of this._data) {
      const modal = new AnnotationsModal(this.app, data);
      const annotationFragment = modal.processContent();
      containerDiv.appendChild(annotationFragment)
    }
    
    return fragment;

  }

  renderContent() {
    const fragment = this.processContent();
    this.contentEl.appendChild(fragment);
  }

  private renderEmptyContent(fragment: DocumentFragment) {
    fragment.createEl("p", "No annotations found for this set of references.");
  }

}