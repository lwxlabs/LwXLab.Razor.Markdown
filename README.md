# LwXLab.Markdown

Blazor Markdown editor/preview component using:

- Monaco Editor for editing
- Markdig for Markdown rendering
- Mermaid.js for flowcharts/diagrams
- highlight.js for code highlighting

Targets: `net8.0`, `net9.0`, `net10.0`.

## Install locally

Add the project to your solution:

```bash
dotnet sln add src/LwXLab.Markdown/LwXLab.Markdown.csproj
```

Reference it from your Blazor app:

```bash
dotnet add YourApp.csproj reference ../LwXLab.Markdown/LwXLab.Markdown.csproj
```

## Program.cs

```csharp
using LwXLab.Markdown.Extensions;

builder.Services.AddLwXLabMarkdown(options =>
{
    options.EnableMermaid = true;
    options.EnableHighlight = true;
});
```

## App.razor / main layout

Add the CSS:

```html
<link href="_content/LwXLab.Markdown/lwxlab-markdown.css" rel="stylesheet" />
```

The JS module is imported automatically by the component.

## Usage

```razor
<LwXLab.MarkDown @bind-Value="markdown"
                 ValueHTMLChanged="OnHtmlChanged"
                 EnableEdit="false"
                 Height="600px"
                 Width="100%"
                 EnableMermaid="true"
                 EnableHighlight="true" />

@code {
    private string? markdown = """
    # Hello

    ```mermaid
    flowchart TD
        A[Start] --> B[End]
    ```
    """;

    private Task OnHtmlChanged(string html)
    {
        // store rendered html, index docs, send to API, etc.
        return Task.CompletedTask;
    }
}
```

## Rich editor mode

```razor
<LwXLab.MarkDown @bind-Value="markdown"
                 ValueHTMLChanged="OnHtmlChanged"
                 EnableEdit="true"
                 EnableMonaco="true"
                 SplitView="true"
                 Preview="false"
                 AutoSaveEnabled="true"
                 AutoSaveId="repo-doc-123"
                 Height="70vh" />
```

## Options

Important component parameters:

- `Value`, `ValueChanged`, `ValueHTML`, `ValueHTMLChanged`
- `EnableEdit`, `ReadOnly`, `Preview`, `SplitView`
- `EnableMonaco`, `EnableMermaid`, `EnableHighlight`
- `EnableTables`, `EnableTaskLists`, `EnableEmoji`, `EnableAutoLinks`, `EnableAdvancedExtensions`
- `Height`, `Width`, `MinHeight`, `MaxHeight`, `CssClass`, `PreviewCssClass`
- `ShowToolbar`, `Toolbar`, `ToolbarButtons`, `HideIcons`
- `ShowStatusBar`, `ShowCharacters`, `ShowWords`, `ShowLines`
- `AutoSaveEnabled`, `AutoSaveId`, `AutoSaveDelay`
- `EditorOptions` for Monaco settings, including editor `FontSize` and `LineWrapping`
- `PreviewFontSize` for rendered preview text size
- `FitContentToWidth` to wrap long editor/preview lines and avoid horizontal scrolling
- `Options` for script/CDN overrides

## Font size and fit-to-width

Version `1.0.0-preview.3` keeps the existing Monaco editor font controls and adds preview sizing plus an opt-in fit-to-width mode.

```razor
@using LwXLab.Markdown.Options

<LwXLab.MarkDown Value="@content"
                 EnableMonaco="true"
                 EditorOptions="@editorOptions"
                 PreviewFontSize="13"
                 FitContentToWidth="true" />

@code {
    private readonly LwMarkdownEditorOptions editorOptions = new()
    {
        FontSize = 13,
        LineWrapping = true
    };
}
```

`FitContentToWidth` forces Monaco wrapping, hides its horizontal scrollbar, wraps the textarea fallback, and constrains preview lines, code blocks, tables, and media to the available width. It is disabled by default so existing consumers keep their current behavior.

## Custom toolbar

```razor
<LwXLab.MarkDown @ref="editor" @bind-Value="markdown">
    <Toolbar>
        <button type="button" @onclick="InsertApiBlock">API block</button>
    </Toolbar>
</LwXLab.MarkDown>

@code {
    private LwXLab.MarkDown? editor;
    private string? markdown;

    private async Task InsertApiBlock()
    {
        if (editor is not null)
            await editor.InsertTextAsync("```http\nGET /api/v1/items\n```\n");
    }
}
```

## Notes

- Monaco, Mermaid and highlight.js are loaded from CDN by default. Override URLs with `LwMarkdownOptions` when you want self-hosted static assets.
- For a production public editor, add HTML sanitization before storing/displaying untrusted content. This skeleton keeps HTML enabled because developer documentation often needs raw HTML.


## Line styling for logs and diagnostics

Version `1.0.0-preview.2` added optional, generic regular-expression based line styling. It does not change normal Markdown behavior unless explicitly enabled.

- Monaco edit mode uses whole-line decorations without changing the source text.
- Preview line mode emits one escaped HTML element per source line.
- Rules are evaluated in order; the first matching rule wins.
- Invalid or timed-out regular expressions are ignored rather than breaking rendering.

```razor
@using LwXLab.Markdown.Models

<MarkDown Value="@LogText"
          EnableEdit="true"
          ReadOnly="true"
          EnableMonaco="true"
          EnableLineStyling="true"
          PreservePreviewLineBreaks="true"
          LineStyleRules="@LogStyleRules"
          Theme="dark" />

@code {
    private string LogText = string.Empty;

    private static readonly IReadOnlyList<LwMarkdownLineStyleRule> LogStyleRules =
    [
        new() { Pattern = @"\[(agent|Answering)\]", CssClass = "lwx-log-agent" },
        new() { Pattern = @"\[(LookingUp|Reading|ListingFiles|Found)\]", CssClass = "lwx-log-looking-up" },
        new() { Pattern = @"\[(RunningCommand|SendingToModel|StreamingResponse|ProcessingToolResult)\]", CssClass = "lwx-log-running" },
        new() { Pattern = @"\[(Passed|Completed|Succeeded)\]|=>\s*Passed\b", CssClass = "lwx-log-success" },
        new() { Pattern = @"\[(Failed|Error)\]|Agent failed:|=>\s*Failed\b", CssClass = "lwx-log-failure" },
        new() { Pattern = @"\[(Retrying|Warning)\]", CssClass = "lwx-log-retry" }
    ];
}
```

The package includes the `lwx-log-*` classes used above. Applications can instead supply any CSS class names and define their own styles.

A rule can also provide CSS declarations directly without defining a class:

```csharp
new LwMarkdownLineStyleRule
{
    Pattern = @"\[(Failed|Error)\]|=>\s*Failed\b",
    CssStyle = "color: #ff7b72; background: rgba(248, 81, 73, .10); " +
               "border-left: 3px solid #f85149; font-weight: 600;"
}
```

`CssClass` and `CssStyle` can be used separately or together. Inline declarations are scoped through a generated runtime class in Monaco edit mode and written to the matching line in line-preserving preview mode. Since styles are supplied by the application, only pass trusted CSS declarations.

`PreservePreviewLineBreaks` deliberately renders escaped line-oriented text rather than normal Markdown. Use it for logs, traces, terminal output, and diagnostics. Leave it disabled for regular Markdown documents.
