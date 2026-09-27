import {createElement} from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function Markdown({text}: {text: string}) {
  return createElement('div', {className: 'markdown'}, createElement(ReactMarkdown, {
    remarkPlugins: [remarkGfm], skipHtml: true, children: text,
    components: {
      a: ({children, href}) => createElement('a', {href, target: '_blank', rel: 'noopener noreferrer'}, children),
      img: ({alt}) => createElement('span', {className: 'image-description'}, `[이미지: ${alt || '설명 없음'}]`),
    },
  }));
}
