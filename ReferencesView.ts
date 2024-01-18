import { ItemView, MarkdownView, WorkspaceLeaf, Modal, Notice, setIcon } from 'obsidian';

import BibcitePlugin from './main';
import { exportItems, attachments, collectionCitekeys } from "ZoteroFunctions.ts";

export const ReferencesViewType = 'ReferencesView';

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

  setHeader(header: HTMLElement, bibliographyMode=false){
    const mode = bibliographyMode ? 'Bibliography' : 'References' 
    const oppositeMode = bibliographyMode ? 'References' : 'Bibliography'

    const headerText = header.createEl("span", { text: mode, cls: "references-header-text" });
    const refreshButton = header.createEl("button", { text: "Refresh", cls: "refresh-button" , title: "Refresh"});
    setIcon(refreshButton, "refresh-cw");
    const modeButton = header.createEl("button", { text: "Switch References/Bibliography Mode", cls: "mode-button", title: `Switch to ${oppositeMode} mode` });
    setIcon(modeButton, "book-copy");
    const annotationsButton = header.createEl("button", { text: "Annotations", cls: "annotations-button", title: `Annotations` });
    
    setIcon(annotationsButton, "book-open-text");
    annotationsButton.onclick = async (e) => {
      const refs = bibliographyMode == false ? this.references['citations']: this.references['bibliography'];
      const attachmentAnnotations = await this.processAttachments(refs);
      new MultiAnnotationsModal(this.app, attachmentAnnotations).open();
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

  setViewContent(content: HTMLElement, bibliographyMode=false) {
    this.contentEl.empty();
    const containerDiv = this.contentEl.createDiv({cls:"container-div" });
    const header = containerDiv.createDiv({cls:"references-header"});

    this.setHeader(header, bibliographyMode);

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

  getViewType() {
    return ReferencesViewType;
  }

  getDisplayText() {
    return 'References';
  }

  getIcon() {
    return 'graduation-cap';
  }

  processReferences = async () => {

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
          refs = {'library': null, 'citations': [], 'bibliography': []};
          this.references = refs;
          return this.references;
        }
        if (!Object.hasOwn(frontMatter, 'zotero_collection')){
          refs = {'library': null, 'citations': [], 'bibliography': []};
          this.references = refs;
          return this.references;
        }

        const libraryName = frontMatter.zotero_collection.split("/")[0];

        const citekeys = await collectionCitekeys(frontMatter.zotero_collection);
        const citekeys_unique = new Set(citekeys)

				const re = /\[(@[a-zA-Z0-9_-]+[ ]*;?[ ]*)+\]/g

				let matches = fileContent.match(re)
        
        if (matches){
          matches = matches.map(item => item.slice(1, -1).split(";").map( i => i.trim().replace("@", "") ));
          matches = matches.flat(1).filter((item) => citekeys.includes(item));
        } else {
          matches = [];
        }
        

				const matches_unique = new Set(matches)

        refs = {'library': libraryName, 'citations': [...matches_unique], 'bibliography': [...citekeys_unique]};
        this.references = refs;
        return this.references;

			} catch (e) {
				console.error(e);
				refs = {'library': null, 'citations': [], 'bibliography': [], 'error': e};
        this.references = refs;
        return this.references;

			}
		} else {
			refs = {'library': null, 'citations': [], 'bibliography': []};
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

  this.renderAttachments(refs.citations);

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

    this.setViewContent(containerDiv, true); // bibliographyMode=false

  this.renderAttachments(refs.bibliography);

  };

  async processAttachments(referenceEntries):Promise<ItemAnnotationsData[]> {

    const allAnnotationsData:ItemAnnotationsData[] = [];
    
    for (const item of referenceEntries) {
      
      const allAttachments = await attachments(item)
      
      const itemAttachments = allAttachments.filter(attach => attach.path != false)

      if (itemAttachments.length){
        const linkAttachment = itemAttachments[0]['open'];
        const linkAnnotations = itemAttachments[0]['annotations'];

        if (linkAnnotations?.length){

          const data:ItemAnnotationsData = {citekey: item, parentUri: linkAttachment, annotations: linkAnnotations};

          allAnnotationsData.push(data);
  
        }
        
      }

    }

    return allAnnotationsData;

  }

  async renderAttachments(referenceEntries) {

    const containerDiv = document.createElement('div');
    containerDiv.classList.add('references-div');
    
    for (const item of referenceEntries) {
      
      const allAttachments = await attachments(item)
      
      const itemAttachments = allAttachments.filter(attach => attach.path != false)

      if (itemAttachments.length){
        const linkAttachment = itemAttachments[0]['open'];
        const linkAnnotations = itemAttachments[0]['annotations'];

        const linkDomElement = this.contentEl.querySelector(`.reference-div .reference-title a[data-citekey='${item}']`);
        linkDomElement?.setAttribute('href', linkAttachment);

        if (linkAnnotations?.length){

          const citeKeyDomElement = this.contentEl.querySelector(`.reference-div .reference-citekey[data-citekey='${item}']`);

          let annotationsIcon = document.createElement("span");
          annotationsIcon.addClass("annotations-icon");
          annotationsIcon.setAttribute("title", "Review Annotations");
          setIcon(annotationsIcon, "book-open-text");
          annotationsIcon.onclick = (e) => {
            new AnnotationsModal(this.app, item, linkAttachment, linkAnnotations).open();
          };
          
          citeKeyDomElement?.appendChild(annotationsIcon);
  
        }
        
      }

    }

  };

}


export class AnnotationsModal extends Modal {
  private _citekey: string;
  private _parentUri: string;
  private _annotations: Object;

  constructor(app: App, private citekey: string, private parentUri: string, private annotations: Object) {
    super(app);
    this._citekey = citekey;
    this._parentUri = parentUri;
    this._annotations = annotations;
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
    const fragment = document.createDocumentFragment();
    fragment.createEl("h2", { text: `Annotations of @${citekey}` });

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



interface ItemAnnotationsData {
  citekey: string;
  parentUri: string;
  annotations: Object;
}



export class MultiAnnotationsModal extends Modal {
  private _data: ItemAnnotationsData[];

  constructor(app: App, private annotationData: ItemAnnotationsData[]) {
    super(app);
    this._data = annotationData;
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
    const fragment = document.createDocumentFragment();

    for (const data of this._data) {
      const modal = new AnnotationsModal(this.app, data.citekey, data.parentUri, data.annotations);
      const annotationFragment = modal.processContent();
      fragment.appendChild(annotationFragment)
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