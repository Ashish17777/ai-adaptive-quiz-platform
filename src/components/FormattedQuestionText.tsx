import React, { useState } from 'react';
import { Copy, Check, Code } from 'lucide-react';

interface FormattedQuestionTextProps {
  text: string;
  className?: string;
}

interface TextSegment {
  type: 'text' | 'codeblock';
  content: string;
  language?: string;
}

/**
 * Clean and format collapsed single-line code if the AI generated it without newlines.
 */
function normalizeCodeIndentation(code: string, language?: string): string {
  if (!code) return '';

  // Unescape literal \n or \t strings if JSON string escaped them
  let cleaned = code.replace(/\\n/g, '\n').replace(/\\t/g, '    ').trim();

  // If the code already has multiple lines, return as-is
  if (cleaned.includes('\n')) {
    return cleaned;
  }

  // If the single line contains Python syntax that got squashed
  const lang = (language || '').toLowerCase();
  if (lang.includes('py') || cleaned.includes('def ') || cleaned.includes('import ')) {
    cleaned = cleaned
      .replace(/(\bdef\s+[a-zA-Z0-9_]+\([^)]*\):)\s*/g, '$1\n    ')
      .replace(/(\bclass\s+[a-zA-Z0-9_]+.*:)\s*/g, '$1\n    ')
      .replace(/(\breturn\b\s+)/g, '\n    $1')
      .replace(/(\bprint\()/g, '\n$1')
      .replace(/(\bfor\s+.*:)\s*/g, '$1\n    ')
      .replace(/(\bwhile\s+.*:)\s*/g, '$1\n    ')
      .replace(/(\bif\s+.*:)\s*/g, '$1\n    ')
      .replace(/(\belif\s+.*:)\s*/g, '$1\n    ')
      .replace(/(\belse:)\s*/g, '$1\n    ');
  } else if (cleaned.includes(';')) {
    // For C / C++ / Java / JS with semicolons
    cleaned = cleaned.replace(/;\s*/g, ';\n');
  }

  return cleaned.trim();
}

/**
 * Parse a question text string into text segments and code block segments.
 */
function parseSegments(rawText: string): TextSegment[] {
  if (!rawText) return [];

  const textWithNormalizedNewlines = rawText.replace(/\\n/g, '\n');
  const segments: TextSegment[] = [];
  // Matches ```language? \n? code ```
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\s*([\s\S]*?)```/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(textWithNormalizedNewlines)) !== null) {
    const textBefore = textWithNormalizedNewlines.slice(lastIndex, match.index).trim();
    if (textBefore) {
      segments.push({ type: 'text', content: textBefore });
    }

    const language = match[1]?.trim() || 'code';
    const codeContent = normalizeCodeIndentation(match[2], language);

    segments.push({
      type: 'codeblock',
      language,
      content: codeContent
    });

    lastIndex = codeBlockRegex.lastIndex;
  }

  const remaining = textWithNormalizedNewlines.slice(lastIndex).trim();
  if (remaining) {
    segments.push({ type: 'text', content: remaining });
  }

  return segments;
}

/**
 * Renders inline text, handling inline `code` backticks.
 */
const InlineTextRenderer: React.FC<{ text: string }> = ({ text }) => {
  const parts = text.split(/(`[^`]+`)/g);

  return (
    <span>
      {parts.map((part, i) => {
        if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
          const inlineCode = part.slice(1, -1);
          return (
            <code
              key={i}
              className="px-1.5 py-0.5 mx-0.5 rounded bg-slate-800/90 border border-slate-700/80 font-mono text-xs text-indigo-300 font-semibold"
            >
              {inlineCode}
            </code>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
};

/**
 * A dedicated code box component with syntax frame, language badge, and one-click copy.
 */
export const CodeBox: React.FC<{ code: string; language?: string }> = ({ code, language }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      // Fallback
    }
  };

  const displayLang = (language && language !== 'code') ? language.toUpperCase() : 'CODE';

  return (
    <div className="my-3.5 rounded-xl border border-slate-700/80 bg-slate-950 overflow-hidden shadow-xl shadow-black/30 text-left">
      {/* Code Header Bar */}
      <div className="flex items-center justify-between px-3.5 py-2 bg-slate-900 border-b border-slate-800 text-xs">
        <div className="flex items-center space-x-2.5">
          <div className="flex space-x-1.5 opacity-70">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
          </div>
          <span className="flex items-center space-x-1.5 pl-2 text-[11px] font-mono font-bold tracking-wider text-slate-300">
            <Code className="w-3.5 h-3.5 text-indigo-400" />
            <span>{displayLang}</span>
          </span>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center space-x-1 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors text-[11px] font-medium border border-slate-700/60"
          title="Copy Code"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-semibold">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-slate-400" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code Body */}
      <pre className="p-4 font-mono text-xs sm:text-sm text-emerald-300/95 overflow-x-auto whitespace-pre leading-relaxed select-text font-normal">
        <code>{code}</code>
      </pre>
    </div>
  );
};

/**
 * Formatted Question Text: Splits and renders markdown text and Code Boxes seamlessly.
 */
export const FormattedQuestionText: React.FC<FormattedQuestionTextProps> = ({
  text,
  className = ''
}) => {
  const segments = parseSegments(text);

  if (segments.length === 0) {
    return <span className={className}>{text}</span>;
  }

  return (
    <div className={`space-y-2.5 ${className}`}>
      {segments.map((seg, idx) => {
        if (seg.type === 'codeblock') {
          return <CodeBox key={idx} code={seg.content} language={seg.language} />;
        }
        return (
          <div key={idx} className="whitespace-pre-line leading-relaxed">
            <InlineTextRenderer text={seg.content} />
          </div>
        );
      })}
    </div>
  );
};

/**
 * Formatted Option Text: Properly renders code options, multiple lines, and inline backticks.
 */
export const FormattedOptionText: React.FC<{ text: string; className?: string }> = ({
  text,
  className = ''
}) => {
  if (!text) return null;

  // Unescape literal \n strings in options
  const clean = text.replace(/\\n/g, '\n');
  const isMultiLine = clean.includes('\n');
  const looksLikeCode = isMultiLine || /^[\[\{\(0-9]|Error|None|True|False|null|undefined/i.test(clean.trim());

  return (
    <span
      className={`inline-block text-left whitespace-pre-line leading-relaxed ${
        looksLikeCode ? 'font-mono text-xs sm:text-sm tracking-tight' : ''
      } ${className}`}
    >
      <InlineTextRenderer text={clean} />
    </span>
  );
};

export default FormattedQuestionText;
