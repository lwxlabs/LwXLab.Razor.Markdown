using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using Markdig;
using Markdig.Extensions.AutoIdentifiers;
using LwXLab.Markdown.Models;
using LwXLab.Markdown.Options;

namespace LwXLab.Markdown.Services;

public sealed class LwMarkdownRenderer
{
    private readonly MarkdownPipeline _pipeline;

    public LwMarkdownRenderer(LwMarkdownOptions options)
    {
        var builder = new MarkdownPipelineBuilder();

        if (options.EnableAdvancedExtensions)
            builder.UseAdvancedExtensions();
        else
        {
            if (options.EnablePipeTables) builder.UsePipeTables();
            if (options.EnableGridTables) builder.UseGridTables();
            if (options.EnableTaskLists) builder.UseTaskLists();
            if (options.EnableAutoLinks) builder.UseAutoLinks();
            if (options.EnableEmoji) builder.UseEmojiAndSmiley();
        }

        builder.UseAutoIdentifiers(AutoIdentifierOptions.GitHub);

        if (options.EnableBootstrap)
            builder.UseBootstrap();

        if (!options.EnableHtml)
            builder.DisableHtml();

        _pipeline = builder.Build();
    }

    public string Render(string? markdown)
    {
        markdown ??= string.Empty;
        return Markdig.Markdown.ToHtml(markdown, _pipeline);
    }

    /// <summary>
    /// Renders normal Markdown unless line-preserving preview styling is explicitly enabled.
    /// Line-preserving mode is intended for logs, traces, diagnostics, and other line-oriented text.
    /// </summary>
    public string Render(
        string? markdown,
        IReadOnlyList<LwMarkdownLineStyleRule>? lineStyleRules,
        bool enableLineStyling,
        bool preservePreviewLineBreaks)
    {
        markdown ??= string.Empty;

        if (!enableLineStyling ||
            !preservePreviewLineBreaks ||
            lineStyleRules is null ||
            lineStyleRules.Count == 0)
        {
            return Markdig.Markdown.ToHtml(markdown, _pipeline);
        }

        return RenderStyledLines(markdown, lineStyleRules);
    }

    private static string RenderStyledLines(
        string source,
        IReadOnlyList<LwMarkdownLineStyleRule> rules)
    {
        var compiledRules = rules
            .Where(rule =>
                rule.ApplyToPreview &&
                !string.IsNullOrWhiteSpace(rule.Pattern) &&
                (!string.IsNullOrWhiteSpace(rule.CssClass) ||
                 !string.IsNullOrWhiteSpace(rule.CssStyle)))
            .Select(rule => TryCompile(rule))
            .Where(item => item is not null)
            .Select(item => item!)
            .ToArray();

        var lines = source.Replace("\r\n", "\n", StringComparison.Ordinal).Replace('\r', '\n').Split('\n');
        var html = new StringBuilder(Math.Max(128, source.Length + lines.Length * 48));
        html.Append("<div class=\"lwx-md-line-document\">");

        foreach (var line in lines)
        {
            var matchingRule = FindMatchingRule(line, compiledRules);
            html.Append("<div class=\"lwx-md-source-line");

            if (!string.IsNullOrWhiteSpace(matchingRule?.Rule.CssClass))
            {
                html.Append(' ');
                html.Append(WebUtility.HtmlEncode(matchingRule.Rule.CssClass));
            }

            html.Append('\"');
            if (!string.IsNullOrWhiteSpace(matchingRule?.Rule.CssStyle))
            {
                html.Append(" style=\"");
                html.Append(WebUtility.HtmlEncode(matchingRule.Rule.CssStyle));
                html.Append('\"');
            }

            html.Append('>');
            html.Append(line.Length == 0 ? "&nbsp;" : WebUtility.HtmlEncode(line));
            html.Append("</div>");
        }

        html.Append("</div>");
        return html.ToString();
    }

    private static CompiledLineStyleRule? TryCompile(LwMarkdownLineStyleRule rule)
    {
        try
        {
            return new CompiledLineStyleRule(rule, rule.CreateRegex());
        }
        catch (ArgumentException)
        {
            // Invalid consumer-provided expressions are ignored so rendering remains available.
            return null;
        }
    }

    private static CompiledLineStyleRule? FindMatchingRule(
        string line,
        IReadOnlyList<CompiledLineStyleRule> rules)
    {
        foreach (var item in rules)
        {
            try
            {
                var match = item.Regex.Match(line);
                if (!match.Success)
                    continue;

                if (item.Rule.MatchWholeLine && (match.Index != 0 || match.Length != line.Length))
                    continue;

                return item;
            }
            catch (RegexMatchTimeoutException)
            {
                // Skip pathological rules without breaking the preview.
            }
        }

        return null;
    }

    private sealed record CompiledLineStyleRule(
        LwMarkdownLineStyleRule Rule,
        System.Text.RegularExpressions.Regex Regex);
}
