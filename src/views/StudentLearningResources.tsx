import React, { useState, useMemo } from 'react';
import { useStore } from '../store';
import { useLearningResourcesSubscription } from '../hooks/useDomainSubscriptions';
import { LearningResource, LearningResourceType } from '../types';
import ResourceReaderModal from '../components/ResourceReaderModal';
import ReadAloudPlayer from '../components/ReadAloudPlayer';
import {
  BookOpen,
  FileText,
  Image as ImageIcon,
  Link as LinkIcon,
  Sparkles,
  Search,
  Volume2,
  Download,
  ExternalLink,
  GraduationCap,
  Calendar,
  User,
  Filter,
  CheckCircle2,
  Layers,
  ChevronRight
} from 'lucide-react';

export default function StudentLearningResources() {
  const { data, currentUser, schoolId } = useStore();
  const student = currentUser as any;
  const studentClass = student?.class || '';

  // Real-time subscription to school learning resources
  const { resources: liveResources, loading: resourcesLoading } = useLearningResourcesSubscription(
    schoolId,
    studentClass
  );

  // Merge store and live resources with class filtering
  const allResources = useMemo(() => {
    const map = new Map<string, LearningResource>();

    // 1. Local fallback from store
    (data.learningResources || []).forEach(r => {
      // Filter for this student's class or 'All'
      if (!r.targetClass || r.targetClass === 'All' || r.targetClass.toLowerCase() === 'all') {
        map.set(r.id, r);
      } else if (studentClass) {
        const studentNorm = studentClass.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        const targetNorm = r.targetClass.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        if (targetNorm === studentNorm || studentNorm.includes(targetNorm) || targetNorm.includes(studentNorm)) {
          map.set(r.id, r);
        }
      }
    });

    // 2. Real-time Firestore resources
    (liveResources || []).forEach(r => {
      map.set(r.id, r);
    });

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [liveResources, data.learningResources, studentClass]);

  // Filtering states
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Active reading modal
  const [readingResource, setReadingResource] = useState<LearningResource | null>(null);

  // Quick read aloud audio bar on card
  const [activeAudioResource, setActiveAudioResource] = useState<LearningResource | null>(null);

  // Available subjects from resources + school subjects
  const availableSubjects = useMemo(() => {
    const set = new Set<string>();
    data.subjects.forEach(s => set.add(s));
    allResources.forEach(r => {
      if (r.subject) set.add(r.subject);
    });
    return Array.from(set).sort();
  }, [data.subjects, allResources]);

  // Filtered list
  const filteredResources = useMemo(() => {
    return allResources.filter(r => {
      // Type filter
      if (selectedType !== 'all') {
        if (selectedType === 'diagram_image') {
          if (r.type !== 'diagram' && r.type !== 'image') return false;
        } else if (selectedType === 'doc_pdf') {
          if (r.type !== 'document' && r.type !== 'pdf') return false;
        } else if (r.type !== selectedType) {
          return false;
        }
      }

      // Subject filter
      if (selectedSubject !== 'all' && r.subject !== selectedSubject) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inTitle = r.title.toLowerCase().includes(q);
        const inDesc = r.description?.toLowerCase().includes(q) || false;
        const inTopic = r.topic?.toLowerCase().includes(q) || false;
        const inContent = r.content?.toLowerCase().includes(q) || false;
        const inTags = r.tags?.some(t => t.toLowerCase().includes(q)) || false;
        if (!inTitle && !inDesc && !inTopic && !inContent && !inTags) return false;
      }

      return true;
    });
  }, [allResources, selectedType, selectedSubject, searchQuery]);

  const getTypeBadge = (type: LearningResourceType) => {
    switch (type) {
      case 'diagram':
        return {
          icon: <ImageIcon className="w-3.5 h-3.5" />,
          label: 'Diagram',
          style: 'bg-purple-100 text-purple-800 border-purple-200'
        };
      case 'image':
        return {
          icon: <ImageIcon className="w-3.5 h-3.5" />,
          label: 'Image',
          style: 'bg-indigo-100 text-indigo-800 border-indigo-200'
        };
      case 'book':
        return {
          icon: <BookOpen className="w-3.5 h-3.5" />,
          label: 'Book / Reader',
          style: 'bg-amber-100 text-amber-800 border-amber-200'
        };
      case 'pdf':
        return {
          icon: <FileText className="w-3.5 h-3.5" />,
          label: 'PDF Document',
          style: 'bg-rose-100 text-rose-800 border-rose-200'
        };
      case 'document':
        return {
          icon: <FileText className="w-3.5 h-3.5" />,
          label: 'Document',
          style: 'bg-blue-100 text-blue-800 border-blue-200'
        };
      case 'link':
        return {
          icon: <LinkIcon className="w-3.5 h-3.5" />,
          label: 'Web Link',
          style: 'bg-emerald-100 text-emerald-800 border-emerald-200'
        };
      default:
        return {
          icon: <Sparkles className="w-3.5 h-3.5" />,
          label: 'Study Notes',
          style: 'bg-slate-100 text-slate-800 border-slate-200'
        };
    }
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* Top Hero Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 rounded-[28px] p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-400/40 flex items-center gap-1.5">
              <span>🇬🇧</span> British English Audio Ready
            </span>
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-white/10 text-slate-200">
              Class: {studentClass || 'General'}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-white m-0 tracking-tight">
            My Learning Resources
          </h1>
          <p className="text-slate-300 text-sm mt-2 mb-0 leading-relaxed">
            Explore curated textbooks, diagrams, documents, and study notes uploaded by your teachers.
            Use the <strong>Read Aloud</strong> feature to listen to lessons loudly in crystal-clear British English.
          </p>

          <div className="flex items-center gap-4 mt-5 text-xs text-indigo-200">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <strong>{allResources.length}</strong> Resources Available
            </span>
            <span className="flex items-center gap-1.5">
              <Volume2 className="w-4 h-4 text-rose-400" />
              Loud British Pronunciation
            </span>
          </div>
        </div>

        <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-1/6 translate-y-1/6 pointer-events-none">
          <BookOpen className="w-80 h-80 text-white" />
        </div>
      </div>

      {/* Floating Active Audio Player Bar (if user launched quick audio) */}
      {activeAudioResource && (
        <div className="sticky top-4 z-40 animate-in slide-in-from-top-4 duration-200">
          <ReadAloudPlayer
            content={activeAudioResource.content || activeAudioResource.description || ''}
            title={activeAudioResource.title}
            autoPlay={true}
          />
        </div>
      )}

      {/* Search & Filters */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by topic, keyword, or document title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
            />
          </div>

          {/* Subject Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none min-w-[160px]"
            >
              <option value="all">All Subjects</option>
              {availableSubjects.map(sub => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Type Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
          {[
            { id: 'all', label: 'All Formats', icon: Layers },
            { id: 'diagram_image', label: 'Diagrams & Images', icon: ImageIcon },
            { id: 'doc_pdf', label: 'Documents & PDFs', icon: FileText },
            { id: 'book', label: 'Books & Readers', icon: BookOpen },
            { id: 'link', label: 'Web Links', icon: LinkIcon },
            { id: 'notes', label: 'Study Notes', icon: Sparkles }
          ].map(tab => {
            const Icon = tab.icon;
            const isSelected = selectedType === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedType(tab.id)}
                className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Resources Grid */}
      {filteredResources.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-sm max-w-lg mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-8 h-8 opacity-80" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 m-0">No Learning Resources Found</h3>
          <p className="text-sm text-slate-500 mt-1 mb-5">
            {searchQuery || selectedSubject !== 'all' || selectedType !== 'all'
              ? 'Try adjusting your search criteria or filter options to view available materials.'
              : `Your teachers haven't uploaded learning materials for ${studentClass || 'your class'} yet.`}
          </p>
          {(searchQuery || selectedSubject !== 'all' || selectedType !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedSubject('all');
                setSelectedType('all');
              }}
              className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-all cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredResources.map(resource => {
            const badge = getTypeBadge(resource.type);
            const hasAudio = !!(resource.content || resource.description);

            return (
              <div
                key={resource.id}
                className="bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col overflow-hidden group hover:border-indigo-300"
              >
                {/* Visual Thumbnail for Images / Diagrams */}
                {resource.fileUrl && (resource.type === 'diagram' || resource.type === 'image' || resource.mimeType?.startsWith('image/')) ? (
                  <div
                    className="h-44 w-full bg-slate-100 overflow-hidden relative cursor-pointer group-hover:opacity-95 transition-opacity"
                    onClick={() => setReadingResource(resource)}
                  >
                    <img
                      src={resource.fileUrl}
                      alt={resource.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                      <span className="text-white text-xs font-semibold flex items-center gap-1">
                        <span>Click to open reader & diagram</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="h-3 bg-gradient-to-r from-indigo-500 via-purple-500 to-rose-500 w-full" />
                )}

                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    {/* Badges */}
                    <div className="flex items-center gap-2 flex-wrap mb-2.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${badge.style}`}>
                        {badge.icon}
                        <span>{badge.label}</span>
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                        {resource.subject}
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {resource.targetClass === 'All' ? 'All Classes' : resource.targetClass}
                      </span>
                    </div>

                    {/* Title */}
                    <h3
                      onClick={() => setReadingResource(resource)}
                      className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors m-0 cursor-pointer line-clamp-2"
                    >
                      {resource.title}
                    </h3>

                    {/* Description or excerpt */}
                    <p className="text-xs text-slate-500 mt-2 line-clamp-3 leading-relaxed">
                      {resource.description || resource.content || 'Tap to open and read full lesson content.'}
                    </p>
                  </div>

                  {/* Metadata & Actions */}
                  <div className="space-y-3 pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        <span className="truncate max-w-[120px]">{resource.teacherName || resource.createdBy}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(resource.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric'
                        })}
                      </span>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 pt-1">
                      
                      {/* Read Aloud Button */}
                      {hasAudio && (
                        <button
                          onClick={() => setActiveAudioResource(resource)}
                          className="flex-1 px-3 py-2 bg-gradient-to-r from-rose-500 to-indigo-600 hover:from-rose-600 hover:to-indigo-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
                          title="Read aloud loudly in British English"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                          <span>Read Aloud</span>
                          <span className="text-[10px] bg-white/20 px-1 py-0.2 rounded font-normal">🇬🇧 UK</span>
                        </button>
                      )}

                      {/* Open Viewer Button */}
                      <button
                        onClick={() => setReadingResource(resource)}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs flex items-center gap-1 transition-all cursor-pointer"
                        title="Open interactive reader"
                      >
                        <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                        <span>View</span>
                      </button>

                      {/* Download attachment if present */}
                      {resource.fileUrl && (
                        <a
                          href={resource.fileUrl}
                          download={resource.fileName || 'learning-resource'}
                          className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all cursor-pointer"
                          title="Download file"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      )}

                      {/* External Link if present */}
                      {resource.linkUrl && (
                        <a
                          href={resource.linkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all cursor-pointer"
                          title="Open link"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}

                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reader Modal */}
      {readingResource && (
        <ResourceReaderModal
          resource={readingResource}
          onClose={() => setReadingResource(null)}
        />
      )}

    </div>
  );
}
