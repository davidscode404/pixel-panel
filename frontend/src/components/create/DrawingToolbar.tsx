"use client";

type SetText = (updater: string | ((prev: string) => string)) => void;

interface DrawingToolbarProps {
  currentTool: 'pen' | 'eraser' | string;
  onToolChange: (tool: 'pen' | 'eraser') => void;
  currentColor: string;
  onColorChange: (color: string) => void;
  onClear: () => void;
  textPrompt: string;
  setTextPrompt: SetText;
  onGenerate: () => void;
  isGenerating: boolean;
  panelId: number;
}

export default function DrawingToolbar({
  currentTool,
  onToolChange,
  currentColor,
  onColorChange,
  onClear,
  textPrompt,
  setTextPrompt,
  onGenerate,
  isGenerating,
  panelId,
}: DrawingToolbarProps) {
  const placeholder =
    panelId === 1
      ? "e.g., A superhero standing on a rooftop at sunset, cape flowing in the wind..."
      : panelId === 2
      ? "e.g., Close-up of the hero's determined face as they spot danger below..."
      : panelId === 3
      ? "e.g., The hero leaping into action, diving off the building..."
      : panelId === 4
      ? "e.g., Mid-air combat scene with dramatic lighting and motion lines..."
      : panelId === 5
      ? "e.g., The hero landing heroically, dust and debris around them..."
      : "e.g., Victory pose with the saved civilians cheering in the background...";

  const appendStyle = (styleText: string) => {
    setTextPrompt((prev) => (typeof prev === 'string' ? (prev ? prev + ', ' : '') + styleText : styleText));
  };

  return (
    <div className="h-full flex flex-col p-4 gap-4 border-2 border-border rounded-xl bg-background-secondary">
      {/* Figma-style Toolbar */}
      <div className="bg-background-card rounded-xl px-3 py-2 flex items-center gap-1 shadow-lg border-2 border-border">
        <button
          onClick={() => onToolChange('pen')}
          className={`p-2.5 rounded-lg transition-all ${
            currentTool === 'pen' ? 'bg-accent text-foreground-inverse' : 'text-foreground hover:bg-background-tertiary'
          }`}
          title="Pen"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
        <button
          onClick={() => onToolChange('eraser')}
          className={`p-2.5 rounded-lg transition-all ${
            currentTool === 'eraser' ? 'bg-accent text-foreground-inverse' : 'text-foreground hover:bg-background-tertiary'
          }`}
          title="Eraser"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M16.24 3.56l4.95 4.94c.78.79.78 2.05 0 2.84L12 20.53a4.008 4.008 0 01-5.66 0L2.81 17c-.78-.79-.78-2.05 0-2.84l10.6-10.6c.79-.78 2.05-.78 2.83 0M4.22 15.58l3.54 3.53c.78.79 2.04.79 2.83 0l3.53-3.53-6.36-6.36-3.54 3.53c-.78.79-.78 2.05 0 2.83z"/>
          </svg>
        </button>

        <div className="w-px h-6 bg-border mx-1"></div>

        <input
          type="color"
          value={currentColor}
          onChange={(e) => onColorChange(e.target.value)}
          className="w-8 h-8 rounded cursor-pointer border-2 border-border"
          title="Color"
        />

        <div className="w-px h-6 bg-border mx-1"></div>

        <button
          onClick={onClear}
          className="p-2.5 rounded-lg text-foreground hover:bg-background-tertiary transition-all"
          title="Clear"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {/* Generate Scene Section - Takes up remaining space */}
      <div className="flex-1 flex flex-col space-y-4">
        <div className="bg-background-card rounded-lg border-2 border-border p-3 space-y-3">
          <textarea
            value={textPrompt}
            onChange={(e) => setTextPrompt(e.target.value)}
            placeholder={placeholder}
            className="w-full bg-transparent text-foreground placeholder-foreground-muted focus:outline-none resize-none text-sm leading-relaxed min-h-[100px]"
            rows={5}
          />
          <button
            onClick={onGenerate}
            disabled={isGenerating || !textPrompt.trim()}
            className="w-full p-3 rounded-lg bg-accent text-foreground-inverse hover:bg-accent-hover transition-all disabled:bg-background-muted disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
            title="Generate"
          >
            {isGenerating ? (
              <>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generating...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M7.5 5.6L10 7 8.6 4.5 10 2 7.5 3.4 5 2l1.4 2.5L5 7zm12 9.8L17 14l1.4 2.5L17 19l2.5-1.4L22 19l-1.4-2.5L22 14zM22 2l-2.5 1.4L17 2l1.4 2.5L17 7l2.5-1.4L22 7l-1.4-2.5zm-7.63 5.29a.996.996 0 00-1.41 0L1.29 18.96c-.39.39-.39 1.02 0 1.41l2.34 2.34c.39.39 1.02.39 1.41 0L16.7 11.05a.996.996 0 000-1.41l-2.33-2.35zm-1.03 5.49l-2.12-2.12 2.44-2.44 2.12 2.12-2.44 2.44z"/>
                </svg>
                Generate Art
              </>
            )}
          </button>
        </div>

        {/* Art Style Suggestions - Takes up remaining space */}
        <div className="flex-1 flex flex-col space-y-3">
          <div className="text-xs font-medium text-foreground-secondary">Quick Styles:</div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => appendStyle('in Marvel Comics style')}
              className="px-3 py-1.5 text-xs bg-background-tertiary hover:bg-accent hover:text-foreground-inverse text-foreground rounded-full border border-border transition-colors"
            >
              Marvel
            </button>
            <button
              onClick={() => appendStyle('in DC Comics style')}
              className="px-3 py-1.5 text-xs bg-background-tertiary hover:bg-accent hover:text-foreground-inverse text-foreground rounded-full border border-border transition-colors"
            >
              DC
            </button>
            <button
              onClick={() => appendStyle('in Japanese manga style')}
              className="px-3 py-1.5 text-xs bg-background-tertiary hover:bg-accent hover:text-foreground-inverse text-foreground rounded-full border border-border transition-colors"
            >
              Manga
            </button>
            <button
              onClick={() => appendStyle('in Korean manhwa style')}
              className="px-3 py-1.5 text-xs bg-background-tertiary hover:bg-accent hover:text-foreground-inverse text-foreground rounded-full border border-border transition-colors"
            >
              Manhwa
            </button>
            <button
              onClick={() => appendStyle('in anime style')}
              className="px-3 py-1.5 text-xs bg-background-tertiary hover:bg-accent hover:text-foreground-inverse text-foreground rounded-full border border-border transition-colors"
            >
              Anime
            </button>
            <button
              onClick={() => appendStyle('in retro comic book style')}
              className="px-3 py-1.5 text-xs bg-background-tertiary hover:bg-accent hover:text-foreground-inverse text-foreground rounded-full border border-border transition-colors"
            >
              Retro
            </button>
          </div>
        </div>

        {/* Tip at bottom */}
        <div className="text-xs text-foreground-muted leading-relaxed">
          💡 Tip: Be specific about characters, actions, lighting, and emotions for best results
        </div>
      </div>
    </div>
  );
}


