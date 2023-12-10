import {
	App,
	Editor,
	EditorPosition,
	EditorSuggest,
	EditorSuggestContext,
	EditorSuggestTriggerInfo,
	MarkdownView,
	TFile,
} from 'obsidian';

import BibcitePlugin from 'main';

interface Suggestion {
	query: string;
	startIndex: number;
	label: string;
	isEmptyChoice?: boolean;
	field?: string;
}


export class CitationSuggest extends EditorSuggest<Suggestion> {
	private plugin: BibcitePlugin;
	private readonly app: App;
	private justCompleted: boolean;

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

        const triggerPhrase = '[@';
        const startPos = this.context?.start || {
        line: cursor.line,
        ch: cursor.ch - triggerPhrase.length,
        };

        return {
            start: startPos,
            end: cursor,
            query: editor.getRange(startPos, cursor).substring(triggerPhrase.length),
            };

    }


	getSuggestions(context: EditorSuggestContext): IDateCompletion[] {
        const suggestions = this.getDateSuggestions(context);
        if (suggestions.length) {
            return suggestions;
        }

        // catch-all if there are no matches
        return [{ label: context.query }];
    }

}
