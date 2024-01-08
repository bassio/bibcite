import { ItemView, MarkdownView, WorkspaceLeaf, Modal, Notice, setIcon } from 'obsidian';

import BibcitePlugin from './main';
import { exportItems, attachments, collectionCitekeys } from "ZoteroFunctions.ts";

export const ReferencesViewType = 'ReferencesView';

const fs = require('fs');

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
    this.setEmptyView();
    this.addAction("refresh-cw", "Refresh References", () => {
      this.renderReferences();
    })
  }

  setViewContent(bib: HTMLElement) {
    this.contentEl.empty();
    const containerDiv = this.contentEl.createDiv({cls:"container-div" });
    const header = containerDiv.createDiv({cls:"references-header"});
    const headerText = header.createEl("span", { text: "References", cls: "references-header-text" });
    this.button = header.createEl("button", { text: "Refresh Bibliography", cls: "refresh-button" });
    setIcon(this.button, "refresh-cw");
    this.button.onclick = (e) => {
      this.renderReferences();
    }
    if (!bib) {
      this.setEmptyView();
    } else {
      this.contentEl.append(bib);
    }
  }

  setErrorView(error) {
    this.contentEl.empty();
    const containerDiv = this.contentEl.createDiv({cls:"container-div" });
    const header = containerDiv.createDiv({cls:"references-header"});
    const headerText = header.createEl("span", { text: "References", cls: "references-header-text" });
    this.button = header.createEl("button", { text: "Refresh Bibliography", cls: "refresh-button" });
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

  setEmptyView() {
    this.contentEl.empty();
    const containerDiv = this.contentEl.createDiv({cls:"container-div" });
    const header = containerDiv.createDiv({cls:"references-header"});
    const headerText = header.createEl("span", { text: "References", cls: "references-header-text" });
    this.button = header.createEl("button", { text: "Refresh Bibliography", cls: "refresh-button" });
    setIcon(this.button, "refresh-cw");
    this.button.onclick = (e) => {
      this.renderReferences();
    }
    containerDiv.createDiv({
      cls: 'pane-empty',
      text: 'No set bibliography and/or citations found for the current document.',
    });
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

		const { settings, view } = this;

		const activeView = this.plugin.app.workspace.getActiveFileView();
		const activeFile = this.plugin.app.workspace.getActiveFile();

		if (activeFile) {
			try {
				const fileContent = await this.plugin.app.vault.cachedRead(activeView.file);
        const cache = this.plugin.app.metadataCache.getFileCache(activeFile);
		    const frontMatter = cache.frontmatter;

        if (!frontMatter){
          return {'library': null, 'citations': []}
        }
        if (!Object.hasOwn(frontMatter, 'zotero_collection')){
          return {'library': null, 'citations': []}
        }

        const libraryName = frontMatter.zotero_collection.split("/")[0];

        const citekeys = await collectionCitekeys(frontMatter.zotero_collection);
        
				const re = /\[(@[a-zA-Z0-9_-]+[ ]*;?[ ]*)+\]/g

				let matches = fileContent.match(re).map(item => item.slice(1, -1).split(";").map( i => i.trim().replace("@", "") ));
        
        matches = matches.flat(1).filter((item) => citekeys.includes(item));

				const matches_unique = new Set(matches)

				return  {'library': libraryName, 'citations': [...matches_unique]};

			} catch (e) {
				console.error(e);
				return {'library': null, 'citations': [], 'error': e};
			}
		} else {
			return {'library': null, 'citations': []};
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

    const refData = JSON.parse(await exportItems(refs.citations, "json", refs.library));
    
    for (const item of refs.citations) {
      const itemDiv = document.createElement('div');
      itemDiv.classList.add('reference-div');

      const itemData = refData.flat(1).filter(r => r['id'] == item)[0]

      itemDiv.innerHTML += `<div class="reference-citekey" data-citekey="${itemData['id']}">@${itemData['id']}</div>`;
      itemDiv.innerHTML += `<div class="reference-title"><a data-citekey="${itemData['id']}" href='#0'>${itemData['title']}</a></div>`;
      
      const journal = itemData['container-title-short'] != '' ? itemData['container-title-short'] : itemData['container-title']
      const issueDate = itemData['issued']['date-parts'][0][0] != undefined ? itemData['issued']['date-parts'][0][0] : ''

      itemDiv.innerHTML += `<div class="reference-journal">${journal} ${issueDate}</div>`;

      containerDiv.appendChild(itemDiv);

    }

  this.setViewContent(containerDiv);

  this.renderAttachments(refs);

  };


  async renderAttachments(refs) {

    const containerDiv = document.createElement('div');
    containerDiv.classList.add('references-div');
    
    for (const item of refs.citations) {
      
      const allAttachments = await attachments(item)
      
      console.log(allAttachments);

      const itemAttachments = allAttachments.filter(attach => attach.path != false)

      if (itemAttachments.length){
        const linkAttachment = itemAttachments[0]['open'];
        const linkAnnotations = itemAttachments[0]['annotations'];

        const linkDomElement = this.contentEl.querySelector(`.reference-div .reference-title a[data-citekey='${item}']`);
        linkDomElement?.setAttribute('href', linkAttachment);

        if (linkAnnotations.length){

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
        
      } else {
        
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

  private renderContent() {
    const citekey = this._citekey;
    const fragment = document.createDocumentFragment();
    fragment.createEl("h2", { text: `Annotations of @${citekey}` });

    for (const annotation of this._annotations) {
      this.renderAnnotation(fragment, annotation);
    }

    this.contentEl.appendChild(fragment);
  }

  private renderEmptyContent(fragment: DocumentFragment) {
    fragment.createEl("p", "There are no annotations associated with this reference.");
  }

  private renderAnnotation(fragment: DocumentFragment, annotation: Object){
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