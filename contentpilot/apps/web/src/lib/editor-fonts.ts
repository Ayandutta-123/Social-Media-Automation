export type FontCategory = 'Sans-serif' | 'Display & poster' | 'Serif' | 'Script & handwriting' | 'Monospace';

export type EditorFont = {
  /** CSS font-family stack stored on the layer (and used by the server renderer). */
  id: string;
  label: string;
  category: FontCategory;
  /** Google Fonts family name for the in-browser preview. Omit for system fonts. */
  google?: string;
  /** Google family ships only one weight (display / script faces). */
  singleWeight?: boolean;
};

export const FONT_CATALOG: EditorFont[] = [
  // Sans-serif
  { id: 'system-ui,Segoe UI,sans-serif', label: 'System default', category: 'Sans-serif' },
  { id: 'Inter,system-ui,Helvetica,Arial,sans-serif', label: 'Inter', category: 'Sans-serif', google: 'Inter' },
  { id: 'Helvetica Neue,Helvetica,Arial,sans-serif', label: 'Helvetica / Arial', category: 'Sans-serif' },
  { id: 'Roboto,Helvetica,Arial,sans-serif', label: 'Roboto', category: 'Sans-serif', google: 'Roboto' },
  { id: 'Open Sans,Helvetica,Arial,sans-serif', label: 'Open Sans', category: 'Sans-serif', google: 'Open Sans' },
  { id: 'Lato,Helvetica,Arial,sans-serif', label: 'Lato', category: 'Sans-serif', google: 'Lato' },
  { id: 'Montserrat,Helvetica,Arial,sans-serif', label: 'Montserrat', category: 'Sans-serif', google: 'Montserrat' },
  { id: 'Poppins,Helvetica,Arial,sans-serif', label: 'Poppins', category: 'Sans-serif', google: 'Poppins' },
  { id: 'Raleway,Helvetica,Arial,sans-serif', label: 'Raleway', category: 'Sans-serif', google: 'Raleway' },
  { id: 'Verdana,Geneva,sans-serif', label: 'Verdana', category: 'Sans-serif' },
  { id: 'Trebuchet MS,sans-serif', label: 'Trebuchet', category: 'Sans-serif' },
  // Display
  { id: 'Impact,Haettenschweiler,sans-serif', label: 'Impact (poster)', category: 'Display & poster' },
  { id: 'Bebas Neue,Impact,sans-serif', label: 'Bebas Neue', category: 'Display & poster', google: 'Bebas Neue', singleWeight: true },
  { id: 'Anton,Impact,sans-serif', label: 'Anton', category: 'Display & poster', google: 'Anton', singleWeight: true },
  { id: 'Oswald,Impact,sans-serif', label: 'Oswald', category: 'Display & poster', google: 'Oswald' },
  // Serif
  { id: 'Georgia,serif', label: 'Georgia', category: 'Serif' },
  { id: 'Times New Roman,Times,serif', label: 'Times', category: 'Serif' },
  { id: 'Palatino,Palatino Linotype,serif', label: 'Palatino', category: 'Serif' },
  { id: 'Playfair Display,Georgia,serif', label: 'Playfair Display', category: 'Serif', google: 'Playfair Display' },
  { id: 'Merriweather,Georgia,serif', label: 'Merriweather', category: 'Serif', google: 'Merriweather' },
  { id: 'Lora,Georgia,serif', label: 'Lora', category: 'Serif', google: 'Lora' },
  { id: 'Libre Baskerville,Georgia,serif', label: 'Libre Baskerville', category: 'Serif', google: 'Libre Baskerville' },
  // Script
  { id: 'Lobster,Georgia,cursive', label: 'Lobster', category: 'Script & handwriting', google: 'Lobster', singleWeight: true },
  { id: 'Pacifico,Georgia,cursive', label: 'Pacifico', category: 'Script & handwriting', google: 'Pacifico', singleWeight: true },
  { id: 'Dancing Script,Georgia,cursive', label: 'Dancing Script', category: 'Script & handwriting', google: 'Dancing Script' },
  { id: 'Caveat,Georgia,cursive', label: 'Caveat', category: 'Script & handwriting', google: 'Caveat' },
  // Mono
  { id: 'Courier New,Courier,monospace', label: 'Courier', category: 'Monospace' },
  { id: 'Fira Code,Courier New,monospace', label: 'Fira Code', category: 'Monospace', google: 'Fira Code' },
];

export const FONT_CATEGORIES: FontCategory[] = [
  'Sans-serif',
  'Display & poster',
  'Serif',
  'Script & handwriting',
  'Monospace',
];

export const FONT_WEIGHTS: Array<{ value: string; label: string }> = [
  { value: '300', label: 'Light' },
  { value: '400', label: 'Regular' },
  { value: '500', label: 'Medium' },
  { value: '600', label: 'Semi-bold' },
  { value: '700', label: 'Bold' },
  { value: '800', label: 'Extra-bold' },
  { value: '900', label: 'Black' },
];

export function findFont(stack?: string): EditorFont | undefined {
  if (!stack) return FONT_CATALOG[0];
  const exact = FONT_CATALOG.find((f) => f.id === stack);
  if (exact) return exact;
  const first = stack.split(',')[0].replace(/["']/g, '').trim().toLowerCase();
  return FONT_CATALOG.find((f) => f.id.split(',')[0].toLowerCase() === first);
}

/** One Google Fonts stylesheet URL covering every previewable family. */
export function googleFontsHref(): string {
  const families = FONT_CATALOG.filter((f) => f.google).map((f) => {
    const name = encodeURIComponent(f.google!).replace(/%20/g, '+');
    return f.singleWeight ? `family=${name}` : `family=${name}:wght@300;400;500;600;700;800;900`;
  });
  return `https://fonts.googleapis.com/css2?${families.join('&')}&display=swap`;
}
