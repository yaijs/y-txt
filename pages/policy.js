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
    rewriteDocumentLinks(container);
  } catch (error) {
    console.error(error);
    container.innerHTML = `
      <p>Failed to load this document.</p>
      <p><a href="https://github.com/yaijs/y-txt">Open the repository instead</a>.</p>
    `;
  }
}

function rewriteDocumentLinks(container) {
  const docMap = new Map([
    ['./PRIVACY.md', './privacy.html'],
    ['./SECURITY.md', './security.html'],
    ['./README.md', './readme.html'],
    ['PRIVACY.md', './privacy.html'],
    ['SECURITY.md', './security.html'],
    ['README.md', './readme.html']
  ]);

  container.querySelectorAll('a[href]').forEach((link) => {
    const href = link.getAttribute('href');
    if (!href) return;
    const mapped = docMap.get(href);
    if (mapped) {
      link.setAttribute('href', mapped);
    }
  });
}

void loadPolicyDocument();
