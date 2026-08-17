/** Plain-language heal prompts per incident type (≤1000 chars each). */
export function healPrompt(type: string, detail: string): string {
  const f = `Extract all fields (product_name, price, stock_status, url). Keep the output schema exactly as before.`;
  switch (type) {
    case 'null_burst':
      return `The price field returns null or empty on most rows since the site changed its layout. Re-capture the price for each product from the current page markup and return it as a number. ${f}`;
    case 'row_drop':
      return `The scraper returns far fewer rows than before because the site changed. Products are listed differently now — find the new listing container and extract every product again. ${f}`;
    case 'schema_drift':
      return `The page structure changed and fields no longer map. Re-extract every field from the current markup. ${f}`;
    case 'empty':
      return `The scraper returns no rows since the site redesigned. Locate where products are now listed and extract each one. ${f}`;
    case 'stale':
      return `The scraper needs to be re-verified against the current page. Re-run against the target and correct any selectors that no longer match. ${f}`;
    default:
      return `The scraper output looks wrong (${detail}). Correct the extraction so each product returns product_name, price, stock_status and url. ${f}`;
  }
}
