// Sample HTML/CSS template for the Studio Editor.
// Each editable element has a `data-element` attribute so the editor
// can detect, list, select, and mutate it. The canvas is 600×600.
export const SAMPLE_TEMPLATE_HTML = `
<div
  data-element="background"
  data-element-type="background"
  data-element-name="Background"
  style="position:absolute;inset:0;background:linear-gradient(135deg,#2D4A3E 0%,#4A6D5A 100%);"
></div>

<div
  data-element="decoration"
  data-element-type="shape"
  data-element-name="Accent circle"
  style="position:absolute;top:36px;right:36px;width:120px;height:120px;border-radius:9999px;background:rgba(212,160,23,0.18);border:1px solid rgba(212,160,23,0.55);"
></div>

<img
  data-element="product-image"
  data-element-type="image"
  data-element-name="Product image"
  src="https://images.unsplash.com/photo-1556228720-195a672e8a03?w=400&q=80"
  alt="Product"
  style="position:absolute;top:200px;left:210px;width:180px;height:240px;object-fit:cover;border-radius:6px;box-shadow:0 20px 40px -8px rgba(0,0,0,0.45);"
/>

<div
  data-element="headline"
  data-element-type="text"
  data-element-name="Headline"
  contenteditable="false"
  style="position:absolute;top:60px;left:48px;width:400px;font-family:'Playfair Display',serif;font-size:46px;font-weight:600;line-height:1.05;letter-spacing:-0.01em;color:#F5F0E8;"
>Quiet rituals for clear minds</div>

<div
  data-element="tagline"
  data-element-type="text"
  data-element-name="Tagline"
  contenteditable="false"
  style="position:absolute;top:498px;left:48px;width:504px;font-family:'DM Sans',sans-serif;font-size:14px;font-weight:400;line-height:1.4;letter-spacing:0.04em;color:rgba(245,240,232,0.85);text-transform:uppercase;"
>Adaptogen blend · Stockholm</div>

<div
  data-element="brand-mark"
  data-element-type="text"
  data-element-name="Brand mark"
  contenteditable="false"
  style="position:absolute;top:540px;left:48px;font-family:'DM Sans',sans-serif;font-size:11px;font-weight:600;letter-spacing:0.18em;color:#D4A017;text-transform:uppercase;"
>NORDFORM</div>
`.trim();
