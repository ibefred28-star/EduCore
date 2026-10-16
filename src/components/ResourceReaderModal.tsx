import React, { useState } from 'react';
import { LearningResource } from '../types';
import ReadAloudPlayer from './ReadAloudPlayer';
import { speechService } from '../lib/speechService';
import {
  X,
  Download,
  ExternalLink,
  BookOpen,
  FileText,
  Image as ImageIcon,
  Link as LinkIcon,
  Sparkles,
  Maximize2,
  Calendar,
  User,
  Tag,
  Volume2
} from 'lucide-react';

interface ResourceReaderModalProps {
  resource: LearningResource | null;
  onClose: () => void;
}

export default function ResourceReaderModal({ resource, onClose }: ResourceReaderModalProps) {
  const [activeParagraphIndex, setActiveParagraphIndex] = useState(0);
  const [imageZoomed, setImageZoomed] = useState(false);

  if (!resource) return null;

  // Split content into distinct paragraphs for reader and tracking
  const rawContent = resource.content || resource.description || 'No written text available for this resource.';
  const paragraphs = speechService.prepareChunks(rawContent);

  const handleParagraphClick = (idx: number) => {
    setActiveParagraphIndex(idx);
    speechService.jumpToParagraph(idx);
  };

  const getTypeIcon = () => {
    switch (resource.type) {
      case 'diagram':
      case 'image':
        return <ImageIcon className="w-5 h-5 text-purple-600" />;
      case 'book':
        return <BookOpen className="w-5 h-5 text-amber-600" />;
      case 'pdf':
      case 'document':
        return <FileText className="w-5 h-5 text-blue-600" />;
      case 'link':
        return <LinkIcon className="w-5 h-5 text-emerald-600" />;
      default:
        return <Sparkles className="w-5 h-5 text-indigo-600" />;
    }
  };

  const getTypeLabel = () => {
    switch (resource.type) {
      case 'diagram': return 'Diagram & Anatomy';
      case 'image': return 'Visual Illustration';
      case 'book': return 'Book / E-Reader';
      case 'pdf': return 'PDF Document';
      case 'document': return 'Academic Document';
      case 'link': return 'Web Link';
      default: return 'Study Notes';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden relative">
        
        {/* Top Header Bar */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between gap-4 bg-slate-50/60 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-white shadow-sm border border-slate-200 flex items-center justify-center flex-shrink-0">
              {getTypeIcon()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                  {resource.subject}
                </span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-700">
                  {resource.targetClass === 'All' ? 'All Classes' : resource.targetClass}
                </span>
                <span className="text-[11px] font-medium text-slate-500">
                  {getTypeLabel()}
                </span>
              </div>
              <h2 className="text-lg font-extrabold text-slate-900 truncate mt-1 mb-0">
                {resource.title}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {resource.fileUrl && (
              <a
                href={resource.fileUrl}
                download={resource.fileName || 'learning-resource'}
                className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all cursor-pointer"
                title="Download Attachment"
              >
                <Download className="w-5 h-5" />
              </a>
            )}
            {resource.linkUrl && (
              <a
                href={resource.linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all cursor-pointer"
                title="Open External Resource"
              >
                <ExternalLink className="w-5 h-5" />
              </a>
            )}
            <button
              onClick={() => {
                speechService.stop();
                onClose();
              }}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-all cursor-pointer"
              title="Close reader"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Read Aloud Player Sticky Top */}
        <div className="p-4 bg-slate-900 border-b border-indigo-900/40 flex-shrink-0">
          <ReadAloudPlayer
            content={paragraphs}
            title={resource.title}
            onParagraphChange={(idx) => setActiveParagraphIndex(idx)}
          />
        </div>

        {/* Scrollable Reader Body */}
        <div className="p-6 sm:p-8 overflow-y-auto flex-1 space-y-6 bg-slate-50/30">
          
          {/* Metadata Banner */}
          <div className="flex items-center gap-4 text-xs text-slate-500 border-b border-slate-200/80 pb-4 flex-wrap">
            <span className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              Author: <strong>{resource.teacherName || resource.createdBy}</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              {new Date(resource.createdAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })}
            </span>
            {resource.topic && (
              <span className="flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-slate-400" />
                Topic: <strong>{resource.topic}</strong>
              </span>
            )}
            {resource.fileName && (
              <span className="text-slate-400">
                File: {resource.fileName} ({resource.fileSize ? `${Math.round(resource.fileSize / 1024)} KB` : 'Attached'})
              </span>
            )}
          </div>

          {/* Image / Diagram Viewer */}
          {resource.fileUrl && (resource.type === 'diagram' || resource.type === 'image' || resource.mimeType?.startsWith('image/')) && (
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col items-center">
              <div className="relative group w-full flex justify-center">
                <img
                  src={resource.fileUrl}
                  alt={resource.title}
                  className={`rounded-xl object-contain max-h-[420px] w-auto transition-all ${
                    imageZoomed ? 'scale-125 cursor-zoom-out' : 'cursor-zoom-in'
                  }`}
                  onClick={() => setImageZoomed(!imageZoomed)}
                />
                <button
                  onClick={() => setImageZoomed(!imageZoomed)}
                  className="absolute bottom-3 right-3 bg-slate-900/80 hover:bg-slate-900 text-white p-2 rounded-xl text-xs flex items-center gap-1 shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>{imageZoomed ? 'Reset Zoom' : 'Zoom Image'}</span>
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-2 text-center">
                Click image to zoom in/out. Follow along with the British English audio explanation below.
              </p>
            </div>
          )}

          {/* Web Link Preview Card */}
          {resource.linkUrl && (
            <div className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wide">
                  External Resource Link
                </span>
                <p className="text-xs text-indigo-950 font-mono truncate mt-0.5 mb-0">
                  {resource.linkUrl}
                </p>
              </div>
              <a
                href={resource.linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all flex-shrink-0 cursor-pointer"
              >
                <span>Visit Link</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}

          {/* Formatted Text Content Reader */}
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-indigo-600" />
                Interactive Document Reader
              </span>
              <span className="text-[11px] text-slate-400">
                Click any paragraph to start reading from there
              </span>
            </div>

            <div className="space-y-4 text-slate-800 leading-relaxed font-serif text-base sm:text-lg">
              {paragraphs.map((para, idx) => {
                const isCurrent = idx === activeParagraphIndex;
                return (
                  <p
                    key={idx}
                    onClick={() => handleParagraphClick(idx)}
                    className={`p-3 rounded-xl transition-all cursor-pointer ${
                      isCurrent
                        ? 'bg-rose-50/80 text-slate-900 border-l-4 border-rose-500 font-medium shadow-sm'
                        : 'hover:bg-slate-50 hover:text-slate-950 border-l-4 border-transparent'
                    }`}
                  >
                    {para}
                  </p>
                );
              })}
            </div>
          </div>

          {/* Tags */}
          {resource.tags && resource.tags.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap pt-2">
              <span className="text-xs text-slate-400 font-medium">Keywords:</span>
              {resource.tags.map(t => (
                <span
                  key={t}
                  className="text-xs bg-slate-200/70 text-slate-700 px-2.5 py-1 rounded-lg font-medium"
                >
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 flex-shrink-0">
          <span>EduCore British English Learning Portal</span>
          <button
            onClick={() => {
              speechService.stop();
              onClose();
            }}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold rounded-xl transition-all cursor-pointer"
          >
            Done Reading
          </button>
        </div>

      </div>
    </div>
  );
}
