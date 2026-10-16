import React, { useState, useMemo, useRef } from 'react';
import { useStore } from '../store';
import { useToastStore } from '../store/toast';
import { useLearningResourcesSubscription } from '../hooks/useDomainSubscriptions';
import { LearningResourceRepository } from '../lib/firestore/repositories/learningResourceRepository';
import { LearningResource, LearningResourceType } from '../types';
import { CLASS_OPTIONS } from '../constants';
import ResourceReaderModal from '../components/ResourceReaderModal';
import ReadAloudPlayer from '../components/ReadAloudPlayer';
import { speechService } from '../lib/speechService';
import {
  BookOpen,
  FileText,
  Image as ImageIcon,
  Link as LinkIcon,
  Sparkles,
  Plus,
  Trash2,
  Edit3,
  Search,
  Filter,
  Volume2,
  Upload,
  Download,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  X,
  FileCheck,
  Tag,
  GraduationCap,
  Layers,
  Eye
} from 'lucide-react';

export default function LearningResourcesManager() {
  const { data, currentUser, currentRole, schoolId, updateData } = useStore();
  const { showToast } = useToastStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const teacher = currentRole === 'teacher'
    ? data.teachers.find(t => (t.id || '').trim().toLowerCase() === (currentUser?.id || '').trim().toLowerCase()) || (currentUser as any)
    : null;

  // Real-time Firestore subscription
  const { resources: liveResources } = useLearningResourcesSubscription(schoolId);

  // Merge store and Firestore resources
  const allResources = useMemo(() => {
    const map = new Map<string, LearningResource>();
    (data.learningResources || []).forEach(r => map.set(r.id, r));
    (liveResources || []).forEach(r => map.set(r.id, r));
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [liveResources, data.learningResources]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [selectedClass, setSelectedClass] = useState('all');
  const [selectedType, setSelectedType] = useState('all');

  // Modal states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<LearningResource | null>(null);
  const [resourceToDelete, setResourceToDelete] = useState<LearningResource | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [previewResource, setPreviewResource] = useState<LearningResource | null>(null);

  // Form Fields
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formType, setFormType] = useState<LearningResourceType>('document');
  const [formSubject, setFormSubject] = useState(data.subjects[0] || 'Basic Science & Technology');
  const [formClass, setFormClass] = useState('All');
  const [formTopic, setFormTopic] = useState('');
  const [formTags, setFormTags] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formLinkUrl, setFormLinkUrl] = useState('');
  const [formFileUrl, setFormFileUrl] = useState('');
  const [formFileName, setFormFileName] = useState('');
  const [formFileSize, setFormFileSize] = useState<number | undefined>(undefined);
  const [formMimeType, setFormMimeType] = useState('');
  const [isTestingAudio, setIsTestingAudio] = useState(false);

  const handleOpenAdd = () => {
    setEditingResource(null);
    setFormTitle('');
    setFormDescription('');
    setFormType('document');
    setFormSubject(data.subjects[0] || 'Basic Science & Technology');
    setFormClass('All');
    setFormTopic('');
    setFormTags('');
    setFormContent('');
    setFormLinkUrl('');
    setFormFileUrl('');
    setFormFileName('');
    setFormFileSize(undefined);
    setFormMimeType('');
    setIsTestingAudio(false);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (res: LearningResource) => {
    setEditingResource(res);
    setFormTitle(res.title);
    setFormDescription(res.description || '');
    setFormType(res.type);
    setFormSubject(res.subject);
    setFormClass(res.targetClass || 'All');
    setFormTopic(res.topic || '');
    setFormTags((res.tags || []).join(', '));
    setFormContent(res.content || '');
    setFormLinkUrl(res.linkUrl || '');
    setFormFileUrl(res.fileUrl || '');
    setFormFileName(res.fileName || '');
    setFormFileSize(res.fileSize);
    setFormMimeType(res.mimeType || '');
    setIsTestingAudio(false);
    setIsFormOpen(true);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFormFileName(file.name);
    setFormFileSize(file.size);
    setFormMimeType(file.type);

    // Auto-adjust type based on mime
    if (file.type.startsWith('image/')) {
      setFormType('diagram');
    } else if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      setFormType('pdf');
    } else if (file.name.endsWith('.txt') || file.name.endsWith('.md')) {
      setFormType('notes');
    }

    const reader = new FileReader();

    // If it's a plain text file, read text directly to populate content for Read Aloud!
    if (file.type === 'text/plain' || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) {
          setFormContent(text);
          if (!formTitle) {
            setFormTitle(file.name.replace(/\.[^/.]+$/, ''));
          }
        }
      };
      reader.readAsText(file);
    } else {
      // Read as Data URL for embedding / download
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setFormFileUrl(dataUrl);
        if (!formTitle) {
          setFormTitle(file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' '));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      showToast('Please enter a resource title');
      return;
    }
    if (!formSubject) {
      showToast('Please select a subject');
      return;
    }

    const tagsArray = formTags
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    const resourceId = editingResource?.id || `res_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const newResource: LearningResource = {
      id: resourceId,
      title: formTitle.trim(),
      description: formDescription.trim(),
      type: formType,
      subject: formSubject,
      targetClass: formClass,
      topic: formTopic.trim(),
      tags: tagsArray,
      content: formContent.trim(),
      linkUrl: formLinkUrl.trim(),
      fileUrl: formFileUrl || editingResource?.fileUrl,
      fileName: formFileName || editingResource?.fileName,
      fileSize: formFileSize || editingResource?.fileSize,
      mimeType: formMimeType || editingResource?.mimeType,
      createdBy: currentUser?.name || 'Teacher',
      teacherId: currentUser?.id,
      teacherName: currentUser?.name,
      createdAt: editingResource?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      // 1. Update local store
      updateData(draft => {
        if (!draft.learningResources) draft.learningResources = [];
        const idx = draft.learningResources.findIndex(r => r.id === resourceId);
        if (idx >= 0) {
          draft.learningResources[idx] = newResource;
        } else {
          draft.learningResources.unshift(newResource);
        }
      });

      // 2. Persist to Firestore
      if (schoolId) {
        await LearningResourceRepository.saveResource(schoolId, newResource);
      }

      showToast(editingResource ? 'Resource updated successfully' : 'Resource uploaded and published to students!');
      setIsFormOpen(false);
      speechService.stop();
    } catch (err: any) {
      console.warn('Error saving resource:', err);
      showToast(err.message || 'Failed to save resource');
    }
  };

  const handleDeleteResource = async () => {
    if (!resourceToDelete) return;
    setIsDeleting(true);
    const targetId = resourceToDelete.id;

    try {
      // 1. Remove from local store
      updateData(draft => {
        if (draft.learningResources) {
          draft.learningResources = draft.learningResources.filter(r => r.id !== targetId);
        }
      });

      // 2. Remove from Firestore
      if (schoolId) {
        await LearningResourceRepository.deleteResource(schoolId, targetId);
      }

      showToast(`"${resourceToDelete.title}" was deleted and removed from students' dashboards.`);
      setResourceToDelete(null);
    } catch (err: any) {
      console.warn('Error deleting resource:', err);
      showToast(err.message || 'Failed to delete resource');
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered list
  const filteredResources = useMemo(() => {
    return allResources.filter(r => {
      if (selectedSubject !== 'all' && r.subject !== selectedSubject) return false;
      if (selectedClass !== 'all' && r.targetClass !== selectedClass && r.targetClass !== 'All') return false;
      if (selectedType !== 'all' && r.type !== selectedType) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inTitle = r.title.toLowerCase().includes(q);
        const inDesc = r.description?.toLowerCase().includes(q) || false;
        const inTopic = r.topic?.toLowerCase().includes(q) || false;
        const inContent = r.content?.toLowerCase().includes(q) || false;
        if (!inTitle && !inDesc && !inTopic && !inContent) return false;
      }
      return true;
    });
  }, [allResources, selectedSubject, selectedClass, selectedType, searchQuery]);

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-[28px] p-6 sm:p-8 text-white shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="relative z-10 max-w-xl">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" /> Learning Hub Management
            </span>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-400/30 flex items-center gap-1">
              <span>🇬🇧</span> British English Read Aloud
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white m-0 tracking-tight">
            Learning Resources & Documents
          </h1>
          <p className="text-slate-300 text-sm mt-2 mb-0 leading-relaxed">
            Upload images, diagrams, books, links, PDFs, and study notes. Students can instantly access them
            in their dashboards and listen loudly in formal British English pronunciation.
          </p>
        </div>

        <div className="relative z-10 flex-shrink-0">
          <button
            onClick={handleOpenAdd}
            className="px-5 py-3 bg-gradient-to-r from-rose-500 to-indigo-600 hover:from-rose-600 hover:to-indigo-700 text-white font-bold rounded-2xl text-sm flex items-center gap-2 shadow-lg shadow-indigo-950/50 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-5 h-5" />
            <span>Upload Resource</span>
          </button>
        </div>

        <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none transform translate-x-1/5 translate-y-1/5">
          <BookOpen className="w-96 h-96 text-white" />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <span className="text-xs text-slate-500 font-semibold">Total Resources</span>
          <h3 className="text-2xl font-black text-slate-800 m-0 mt-1">{allResources.length}</h3>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <span className="text-xs text-slate-500 font-semibold">Diagrams & Images</span>
          <h3 className="text-2xl font-black text-purple-700 m-0 mt-1">
            {allResources.filter(r => r.type === 'diagram' || r.type === 'image').length}
          </h3>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <span className="text-xs text-slate-500 font-semibold">Documents & PDFs</span>
          <h3 className="text-2xl font-black text-blue-700 m-0 mt-1">
            {allResources.filter(r => r.type === 'document' || r.type === 'pdf' || r.type === 'book').length}
          </h3>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <span className="text-xs text-slate-500 font-semibold">Read Aloud Ready</span>
          <h3 className="text-2xl font-black text-rose-600 m-0 mt-1">
            {allResources.filter(r => r.content || r.description).length}
          </h3>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search resources by title, topic, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none"
            >
              <option value="all">All Subjects</option>
              {data.subjects.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none"
            >
              <option value="all">All Classes</option>
              {CLASS_OPTIONS.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none"
            >
              <option value="all">All Types</option>
              <option value="diagram">Diagrams</option>
              <option value="image">Images</option>
              <option value="pdf">PDFs</option>
              <option value="document">Documents</option>
              <option value="book">Books</option>
              <option value="link">Links</option>
              <option value="notes">Study Notes</option>
            </select>
          </div>
        </div>
      </div>

      {/* Resources Table / Grid */}
      {filteredResources.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 max-w-lg mx-auto shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-8 h-8 opacity-80" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 m-0">No Resources Found</h3>
          <p className="text-sm text-slate-500 mt-1 mb-5">
            Click "Upload Resource" above to add diagrams, PDFs, books, and study guides for your students.
          </p>
          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-xl text-xs hover:bg-indigo-700 transition-all cursor-pointer"
          >
            Upload New Resource
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredResources.map(resource => (
            <div
              key={resource.id}
              className="bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col overflow-hidden group hover:border-indigo-300"
            >
              {/* Image Preview if available */}
              {resource.fileUrl && (resource.type === 'diagram' || resource.type === 'image' || resource.mimeType?.startsWith('image/')) ? (
                <div
                  className="h-40 w-full bg-slate-100 overflow-hidden relative cursor-pointer"
                  onClick={() => setPreviewResource(resource)}
                >
                  <img
                    src={resource.fileUrl}
                    alt={resource.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <span className="absolute top-3 right-3 bg-slate-900/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                    <ImageIcon className="w-3 h-3" /> Diagram Preview
                  </span>
                </div>
              ) : (
                <div className="h-2.5 bg-gradient-to-r from-indigo-500 to-rose-500 w-full" />
              )}

              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                      {resource.subject}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {resource.targetClass === 'All' ? 'All Classes' : resource.targetClass}
                    </span>
                    <span className="text-[10px] font-medium text-slate-400 capitalize">
                      {resource.type}
                    </span>
                  </div>

                  <h3
                    onClick={() => setPreviewResource(resource)}
                    className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors m-0 cursor-pointer line-clamp-2"
                  >
                    {resource.title}
                  </h3>

                  <p className="text-xs text-slate-500 mt-2 line-clamp-3 leading-relaxed">
                    {resource.description || resource.content || 'Click view to inspect full content.'}
                  </p>
                </div>

                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>By: {resource.teacherName || resource.createdBy}</span>
                    <span>{new Date(resource.createdAt).toLocaleDateString()}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setPreviewResource(resource)}
                        className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl text-xs flex items-center gap-1 transition-all cursor-pointer"
                        title="Open document reader & read aloud"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View / Listen</span>
                      </button>

                      <button
                        onClick={() => handleOpenEdit(resource)}
                        className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all cursor-pointer"
                        title="Edit resource"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => setResourceToDelete(resource)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                        title="Delete resource"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {resource.fileUrl && (
                      <a
                        href={resource.fileUrl}
                        download={resource.fileName || 'learning-resource'}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                        title="Download attached file"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload / Edit Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900 m-0">
                    {editingResource ? 'Edit Learning Resource' : 'Upload Learning Resource'}
                  </h2>
                  <p className="text-xs text-slate-500 m-0">
                    Resource will be immediately visible on students' dashboards under "My Learning Resources"
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  speechService.stop();
                  setIsFormOpen(false);
                }}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-xl transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSaveResource} className="p-6 overflow-y-auto flex-1 space-y-5">
              
              {/* Title */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Resource Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Human Digestive System Diagram & Physiology"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                />
              </div>

              {/* Resource Type */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Resource Format / Type
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { type: 'diagram' as const, label: 'Diagram / Image', icon: ImageIcon },
                    { type: 'pdf' as const, label: 'PDF Document', icon: FileText },
                    { type: 'book' as const, label: 'Book / Reader', icon: BookOpen },
                    { type: 'notes' as const, label: 'Study Notes', icon: Sparkles },
                    { type: 'link' as const, label: 'Web Link', icon: LinkIcon },
                    { type: 'document' as const, label: 'Document', icon: FileCheck }
                  ].map(t => {
                    const Icon = t.icon;
                    const isSelected = formType === t.type;
                    return (
                      <button
                        key={t.type}
                        type="button"
                        onClick={() => setFormType(t.type)}
                        className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-50 border-indigo-500 text-indigo-700 ring-2 ring-indigo-500/20'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <Icon className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                        <span className="truncate">{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Subject & Target Class */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Subject *
                  </label>
                  <select
                    value={formSubject}
                    onChange={(e) => setFormSubject(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  >
                    {data.subjects.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Target Class / Level
                  </label>
                  <select
                    value={formClass}
                    onChange={(e) => setFormClass(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  >
                    <option value="All">All Classes (General)</option>
                    {CLASS_OPTIONS.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Topic & Tags */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Topic / Chapter
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Chapter 3: Cellular Biology"
                    value={formTopic}
                    onChange={(e) => setFormTopic(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Tags (comma separated)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Science, Biology, Organs"
                    value={formTags}
                    onChange={(e) => setFormTags(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  />
                </div>
              </div>

              {/* File Attachment / Upload Area */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Attach Document, Image, Diagram or PDF
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-2xl p-4 text-center cursor-pointer transition-all bg-slate-50/50 hover:bg-indigo-50/20 group"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/*,.pdf,.txt,.docx,.doc,.md"
                    className="hidden"
                  />
                  <div className="flex flex-col items-center justify-center gap-1.5">
                    <Upload className="w-6 h-6 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                    <span className="text-xs font-bold text-slate-700 group-hover:text-indigo-600">
                      {formFileName ? `Attached: ${formFileName}` : 'Click to browse files (Images, PDFs, Documents)'}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Supports JPG, PNG, GIF, WebP, SVG, PDF, TXT, DOCX
                    </span>
                  </div>
                </div>

                {/* Image Preview if uploaded */}
                {formFileUrl && formFileUrl.startsWith('data:image/') && (
                  <div className="mt-3 relative w-32 h-32 rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                    <img src={formFileUrl} alt="Preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => {
                        setFormFileUrl('');
                        setFormFileName('');
                      }}
                      className="absolute top-1 right-1 bg-rose-600 text-white rounded-full p-1"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>

              {/* Link URL (if Web Link type) */}
              {(formType === 'link' || formLinkUrl) && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Web Link URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://example.com/study-material"
                    value={formLinkUrl}
                    onChange={(e) => setFormLinkUrl(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  />
                </div>
              )}

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Brief Overview / Summary
                </label>
                <textarea
                  rows={2}
                  placeholder="Short introductory summary for students..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                />
              </div>

              {/* Content / Text / Transcript (Crucial for Read Aloud in British English) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Study Text & Content (Spoken Aloud in British English) *
                  </label>
                  <span className="text-[11px] text-indigo-600 font-semibold flex items-center gap-1">
                    <span>🇬🇧</span> British English Audio
                  </span>
                </div>
                <p className="text-xs text-slate-500 mb-2">
                  Enter the textbook passage, diagram annotations, chapter notes, or lesson text. This text will be
                  read aloud loudly in crisp British English when pupils click the "Read Aloud" button!
                </p>
                <textarea
                  rows={7}
                  placeholder="Paste or type the study document, textbook notes, or diagram explanation here..."
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-serif leading-relaxed focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                />

                {/* Quick Test Audio Button */}
                <div className="mt-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      if (!formContent.trim()) {
                        showToast('Enter some study text above first to test audio');
                        return;
                      }
                      setIsTestingAudio(!isTestingAudio);
                      if (!isTestingAudio) {
                        speechService.readAloud(formContent.trim());
                      } else {
                        speechService.stop();
                      }
                    }}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Volume2 className="w-3.5 h-3.5 text-rose-500" />
                    <span>{isTestingAudio ? 'Stop Test Audio' : 'Preview British Read Aloud'}</span>
                  </button>

                  <span className="text-xs text-slate-400">
                    {formContent.trim().split(/\s+/).filter(Boolean).length} words
                  </span>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    speechService.stop();
                    setIsFormOpen(false);
                  }}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-gradient-to-r from-rose-500 to-indigo-600 hover:from-rose-600 hover:to-indigo-700 text-white font-bold rounded-xl text-xs shadow-md transition-all cursor-pointer"
                >
                  {editingResource ? 'Save Changes' : 'Publish to Students'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {resourceToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-center">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 m-0">Delete Learning Resource?</h3>
            <p className="text-sm text-slate-600 mt-2 mb-6">
              Are you sure you want to delete <strong>"{resourceToDelete.title}"</strong>?
              It will be permanently removed and will no longer appear on the students' dashboards.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                disabled={isDeleting}
                onClick={() => setResourceToDelete(null)}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={isDeleting}
                onClick={handleDeleteResource}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer"
              >
                {isDeleting ? 'Deleting...' : 'Yes, Delete Resource'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Reader Modal */}
      {previewResource && (
        <ResourceReaderModal
          resource={previewResource}
          onClose={() => setPreviewResource(null)}
        />
      )}

    </div>
  );
}
