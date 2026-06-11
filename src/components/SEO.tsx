import { Helmet } from "react-helmet-async";

const SITE = "https://kinika.studio";

interface SEOProps {
  title: string;
  description: string;
  path: string;
  ogType?: "website" | "article";
  jsonLd?: object | object[];
}

export function SEO({ title, description, path, ogType = "website", jsonLd }: SEOProps) {
  const url = `${SITE}${path}`;
  const ld = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content={ogType} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      {ld.map((item, i) => (
        <script key={i} type="application/ld+json">{JSON.stringify(item)}</script>
      ))}
    </Helmet>
  );
}
