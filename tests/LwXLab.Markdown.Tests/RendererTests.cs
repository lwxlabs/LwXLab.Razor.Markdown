using LwXLab.Markdown.Options;
using LwXLab.Markdown.Services;
using Xunit;

public sealed class RendererTests
{
    [Fact]
    public void RendersMarkdown()
    {
        var renderer = new LwMarkdownRenderer(new());
        Assert.Contains("<strong>bold</strong>", renderer.Render("**bold**"));
    }

    [Fact]
    public void CanDisableRawHtml()
    {
        var renderer = new LwMarkdownRenderer(new LwMarkdownOptions { EnableHtml = false });
        Assert.DoesNotContain("<script>", renderer.Render("<script>alert(1)</script>"));
        Assert.Contains("<strong>bold</strong>", renderer.Render("**bold**"));
    }

    [Fact]
    public void PreservesTrustedHtmlByDefault()
    {
        var renderer = new LwMarkdownRenderer(new());
        Assert.Contains("<b>trusted</b>", renderer.Render("<b>trusted</b>"));
    }
}
