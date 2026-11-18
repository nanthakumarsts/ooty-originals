import { useEffect, useRef } from 'react';
import { Bold, Heading2, Heading3, Italic, Link2, List, ListOrdered, Pilcrow, RemoveFormatting } from 'lucide-react';

/**
 * A small formatted-text editor (headings, bold, lists, links).
 * It is uncontrolled while typing; `resetKey` reloads it when a different record is opened.
 * The server cleans the HTML again before storing it.
 */
export default function RichEditor({ value, onChange, resetKey, minHeight = 220, label }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) ref.current.innerHTML = value || '';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const run = (command, argument) => {
    ref.current.focus();
    document.execCommand(command, false, argument);
    onChange(ref.current.innerHTML);
  };

  const addLink = () => {
    const url = window.prompt('Link address (https://…)');
    if (url && /^(https?:\/\/|mailto:|tel:)/i.test(url.trim())) run('createLink', url.trim());
  };

  // Paste as plain text so formatting from Word or web pages never leaks in.
  const onPaste = (e) => {
    e.preventDefault();
    document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
  };

  const tools = [
    [Pilcrow, 'Paragraph', () => run('formatBlock', 'p')],
    [Heading2, 'Heading', () => run('formatBlock', 'h2')],
    [Heading3, 'Sub-heading', () => run('formatBlock', 'h3')],
    [Bold, 'Bold', () => run('bold')],
    [Italic, 'Italic', () => run('italic')],
    [List, 'Bulleted list', () => run('insertUnorderedList')],
    [ListOrdered, 'Numbered list', () => run('insertOrderedList')],
    [Link2, 'Add link', addLink],
    [RemoveFormatting, 'Clear formatting', () => run('removeFormat')],
  ];

  return (
    <div className="overflow-hidden rounded-lg border border-line-strong bg-white focus-within:border-brand-600 focus-within:ring-4 focus-within:ring-brand-600/10">
      <div className="flex flex-wrap gap-0.5 border-b border-line bg-canvas/60 p-1.5" role="toolbar" aria-label="Formatting">
        {tools.map(([Icon, name, action]) => (
          <button key={name} type="button" title={name} aria-label={name} onMouseDown={(e) => e.preventDefault()} onClick={action} className="flex size-8 items-center justify-center rounded-md text-ink-700 hover:bg-white hover:text-brand-600">
            <Icon className="size-4" aria-hidden />
          </button>
        ))}
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={label}
        onInput={() => onChange(ref.current.innerHTML)}
        onPaste={onPaste}
        className="rich overflow-y-auto px-4 py-3 focus:outline-none"
        style={{ minHeight, maxHeight: 520 }}
      />
    </div>
  );
}
