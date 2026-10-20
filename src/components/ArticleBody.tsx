/** Renders sanitised CMS HTML with the site's article typography. */
export default function ArticleBody({ html, className = "" }: { html: string; className?: string }) {
  return <div className={`cms-body ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
