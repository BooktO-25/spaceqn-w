import React, { useState } from 'react';
import { architectureDocs, ArchitectureDoc } from '../data/architectureDocs';
import { 
  FileCode2, 
  BookOpen, 
  Server, 
  FolderTree, 
  Database, 
  Layers, 
  ShieldCheck, 
  Lock, 
  Cpu, 
  Layout, 
  Milestone, 
  Cloud,
  CheckCircle2,
  Copy
} from 'lucide-react';

interface ArchitectureDocsViewProps {
  darkMode: boolean;
}

export const ArchitectureDocsView: React.FC<ArchitectureDocsViewProps> = ({ darkMode }) => {
  const [selectedDocId, setSelectedDocId] = useState<string>(architectureDocs[0].id);
  const [copied, setCopied] = useState(false);

  const selectedDoc = architectureDocs.find(d => d.id === selectedDocId) || architectureDocs[0];

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedDoc.markdownContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getDocIcon = (id: string) => {
    switch (id) {
      case 'prd': return BookOpen;
      case 'system-arch': return Server;
      case 'folder-structure': return FolderTree;
      case 'db-schema': return Database;
      case 'api-design': return Layers;
      case 'multi-tenant': return ShieldCheck;
      case 'auth-flow': return Lock;
      case 'pairing-flow': return Cpu;
      case 'player-arch': return Cpu;
      case 'ui-wireframes': return Layout;
      case 'roadmap': return Milestone;
      case 'deployment': return Cloud;
      default: return FileCode2;
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className={`p-6 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
        darkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-rose-500/10 text-rose-500 border border-rose-500/20">
              SYSTEM ARCHITECTURE SPECIFICATION
            </span>
            <span className="text-xs text-slate-400">• Phase 1 MVP Digital Signage</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">SPACEQ Display Operating System Architecture</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl">
            Complete technical blueprint covering PRD, multi-tenant database schemas, OpenAPI specs, device pairing sequences, and player runtime specifications.
          </p>
        </div>

        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-800 text-white font-semibold text-xs hover:bg-slate-800 transition-colors shrink-0"
        >
          {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          <span>{copied ? 'Copied Markdown' : 'Copy Spec Documentation'}</span>
        </button>
      </div>

      {/* Docs Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Navigation Menu */}
        <div className={`p-4 rounded-2xl border space-y-1.5 h-fit ${
          darkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <p className="text-[10px] uppercase font-bold text-slate-400 px-3 mb-2">
            12 Engineering Deliverables
          </p>

          {architectureDocs.map((doc) => {
            const Icon = getDocIcon(doc.id);
            const isSelected = doc.id === selectedDocId;

            return (
              <button
                key={doc.id}
                onClick={() => setSelectedDocId(doc.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs text-left font-medium transition-all ${
                  isSelected
                    ? 'bg-rose-600 text-white font-bold shadow-sm'
                    : darkMode
                      ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                      : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                <span className="truncate">{doc.title}</span>
              </button>
            );
          })}
        </div>

        {/* Right Content Viewer */}
        <div className={`p-6 lg:p-8 rounded-2xl border lg:col-span-3 space-y-6 min-h-[600px] ${
          darkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-500 bg-rose-500/10 px-2.5 py-1 rounded border border-rose-500/20">
              {selectedDoc.category}
            </span>
            <h2 className="text-xl font-extrabold mt-2">{selectedDoc.title}</h2>
            <p className="text-xs text-slate-400 mt-1">{selectedDoc.description}</p>
          </div>

          <div className={`p-6 rounded-2xl border font-mono text-xs overflow-x-auto whitespace-pre-wrap leading-relaxed ${
            darkMode ? 'bg-slate-950 border-slate-800/80 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-800'
          }`}>
            {selectedDoc.markdownContent}
          </div>
        </div>
      </div>
    </div>
  );
};
