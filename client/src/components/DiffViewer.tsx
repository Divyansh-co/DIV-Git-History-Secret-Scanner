import React from 'react';
import { ContextLine } from '../types';

interface DiffViewerProps {
  lineNumber: number;
  lineContent: string;
  contextBefore: ContextLine[];
  contextAfter: ContextLine[];
  secretValue: string;
  isBlurred: boolean;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  lineNumber,
  lineContent,
  contextBefore,
  contextAfter,
  secretValue,
  isBlurred,
}) => {
  // Render highlighted secret in lineContent
  const renderHighlightedLine = (text: string) => {
    if (!secretValue || !text.includes(secretValue)) {
      return <span>{text}</span>;
    }

    const parts = text.split(secretValue);
    return (
      <>
        {parts.map((part, index) => (
          <React.Fragment key={index}>
            <span>{part}</span>
            {index < parts.length - 1 && (
              <span
                className={`secret-highlight ${
                  isBlurred ? 'secret-blur' : ''
                }`}
              >
                {secretValue}
              </span>
            )}
          </React.Fragment>
        ))}
      </>
    );
  };

  return (
    <div className="diff-container rounded-xl font-mono text-xs overflow-hidden border border-slate-800 bg-[#060a12]">
      <div className="bg-slate-900/90 px-3 py-1.5 border-b border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
        <span className="font-semibold text-slate-300">Unified Commit Context (±3 lines)</span>
        <span>Line {lineNumber}</span>
      </div>

      <div className="p-2 space-y-0.5 overflow-x-auto">
        {/* Context Before */}
        {contextBefore.map((ctx) => (
          <div key={`before-${ctx.lineNumber}`} className="diff-line diff-line-context">
            <span className="diff-line-number">{ctx.lineNumber}</span>
            <span className="text-slate-500 mr-2 select-none"> </span>
            <span className="text-slate-400">{ctx.content}</span>
          </div>
        ))}

        {/* Added Line (with the secret) */}
        <div className="diff-line diff-line-add py-1">
          <span className="diff-line-number text-emerald-400 font-bold">{lineNumber}</span>
          <span className="text-emerald-400 font-bold mr-2 select-none">+</span>
          <span className="text-slate-100 font-medium">
            {renderHighlightedLine(lineContent)}
          </span>
        </div>

        {/* Context After */}
        {contextAfter.map((ctx) => (
          <div key={`after-${ctx.lineNumber}`} className="diff-line diff-line-context">
            <span className="diff-line-number">{ctx.lineNumber}</span>
            <span className="text-slate-500 mr-2 select-none"> </span>
            <span className="text-slate-400">{ctx.content}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
