const URL_RE = /https?:\/\/[^\s<>"']+/g;

/** Strip all HTML tags and return plain text. Safe for use in search/display contexts. */
export function stripHtml(html: string): string {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '');
}

function isInsideAnchor(node: Node): boolean {
  let p: Node | null = node.parentNode;
  while (p) {
    if (p.nodeName === 'A') return true;
    p = p.parentNode;
  }
  return false;
}

export function linkifyHtml(html: string): string {
  const container = document.createElement('div');
  container.innerHTML = html;
  linkifyNode(container);
  return container.innerHTML;
}

function linkifyNode(root: Node): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const toProcess: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (!isInsideAnchor(node) && URL_RE.test(node.textContent || '')) {
      toProcess.push(node as Text);
    }
    URL_RE.lastIndex = 0; // reset stateful regex
  }
  for (const textNode of toProcess) {
    const text = textNode.textContent || '';
    const frag = document.createDocumentFragment();
    let last = 0;
    URL_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = URL_RE.exec(text))) {
      const url = m[0].replace(/[.,!?);:]+$/, '');
      if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = url;
      frag.appendChild(a);
      last = m.index + m[0].length;
    }
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    textNode.parentNode!.replaceChild(frag, textNode);
  }
}
