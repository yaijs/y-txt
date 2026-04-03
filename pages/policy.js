async function loadPolicyDocument() {
  const container = document.getElementById('doc-content');
  const source = document.body.dataset.docSource;
  if (!container || !source) return;

  try {
    const response = await fetch(`./${source}`, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Failed to load ${source}`);
    }

    const markdown = await response.text();
    const markedLib = globalThis.marked;
    if (!markedLib?.parse) {
      throw new Error('Markdown renderer unavailable.');
    }

    container.innerHTML = markedLib.parse(markdown);
  } catch (error) {
    console.error(error);
    container.innerHTML = `
      <p>Failed to load this document.</p>
      <p><a href="https://github.com/yaijs/y-txt">Open the repository instead</a>.</p>
    `;
  }
}

void loadPolicyDocument();
