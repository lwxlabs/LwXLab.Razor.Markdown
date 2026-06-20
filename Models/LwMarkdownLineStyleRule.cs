using System.Text.RegularExpressions;

namespace LwXLab.Markdown.Models;

/// <summary>
/// Defines a reusable regular-expression rule for styling matching source lines.
/// </summary>
public sealed class LwMarkdownLineStyleRule
{
    /// <summary>Regular-expression pattern tested against each source line.</summary>
    public string Pattern { get; set; } = string.Empty;

    /// <summary>Optional CSS class applied to matching editor and/or preview lines.</summary>
    public string CssClass { get; set; } = string.Empty;

    /// <summary>
    /// Optional inline CSS declarations applied to matching lines, for example
    /// <c>color: #79c0ff; background: rgba(88, 166, 255, .08); font-weight: 600;</c>.
    /// In Monaco edit mode the component creates a scoped runtime CSS class; in preview mode
    /// the declarations are written to the matching line's style attribute.
    /// </summary>
    public string CssStyle { get; set; } = string.Empty;

    /// <summary>Whether matching ignores character casing.</summary>
    public bool IgnoreCase { get; set; } = true;

    /// <summary>Whether the rule is applied to Monaco edit mode.</summary>
    public bool ApplyToEditor { get; set; } = true;

    /// <summary>Whether the rule is applied to line-preserving preview mode.</summary>
    public bool ApplyToPreview { get; set; } = true;

    /// <summary>Whether the regular expression must match the complete source line.</summary>
    public bool MatchWholeLine { get; set; }

    internal Regex CreateRegex()
    {
        var options = RegexOptions.Compiled | RegexOptions.CultureInvariant;
        if (IgnoreCase)
            options |= RegexOptions.IgnoreCase;

        return new Regex(Pattern, options, TimeSpan.FromMilliseconds(250));
    }
}
