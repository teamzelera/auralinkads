import { useState, useEffect } from "react";
import DashboardLayout from "../components/layout/DashboardLayout";
import api from "../api/axios";
import { ListVideo, Plus, Trash2, GripVertical, ChevronDown, ChevronUp, Film, X, Edit, PlusCircle, Settings, RotateCw } from "lucide-react";
import toast from "react-hot-toast";
import { formatDuration } from "../utils/helpers";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortableVideoItem({ id, pv, onRemove, onRotate }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 10 : 1,
        position: 'relative'
    };

    return (
        <div ref={setNodeRef} style={style} className="flex items-center gap-3 p-3 rounded-xl bg-primary-card border border-primary-border mb-2 shadow-sm">
            <div {...attributes} {...listeners} className="cursor-grab hover:text-accent-purple p-1 touch-none">
                <GripVertical className="w-5 h-5 text-primary-border" />
            </div>
            <div className="w-14 h-9 rounded-lg bg-primary-bg border border-primary-border overflow-hidden flex items-center justify-center shrink-0">
                {pv.video.thumbnail ? <img src={pv.video.thumbnail} alt="" className="w-full h-full object-cover" style={{ transform: `rotate(${pv.video.rotation || 0}deg)` }} /> : <Film className="w-4 h-4 text-text-muted" />}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">{pv.video.title}</p>
                <p className="text-xs text-text-muted">{formatDuration(pv.video.duration)}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => onRotate(pv.video.id)} className="text-text-muted hover:text-accent-purple transition-colors p-2">
                    <RotateCw className="w-4 h-4" />
                </button>
                <button onClick={() => onRemove(pv.video.id)} className="text-text-muted hover:text-status-offline transition-colors p-2">
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}

export default function Playlists() {
    const [playlists, setPlaylists] = useState([]);
    const [videos, setVideos] = useState([]);
    const [expanded, setExpanded] = useState(null);

    // Modals
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createForm, setCreateForm] = useState({ name: "", video_ids: [] });

    const [editModal, setEditModal] = useState(null); // The playlist object
    const [editForm, setEditForm] = useState({ name: "", description: "", is_active: true, loop_enabled: true, title_overlay: "", autoplay: true });

    const [addVideoModal, setAddVideoModal] = useState(null); // The playlist id
    const [addVideoForm, setAddVideoForm] = useState({ video_ids: [] });

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    useEffect(() => {
        fetchPlaylists();
        api.get("/videos/").then((r) => setVideos(r.data));
    }, []);

    const fetchPlaylists = async () => {
        const { data } = await api.get("/playlists/");
        setPlaylists(data);
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        const { data } = await api.post("/playlists/", createForm);
        setPlaylists((prev) => [data, ...prev]);
        toast.success("Playlist created!");
        setShowCreateModal(false);
        setCreateForm({ name: "", video_ids: [] });
    };

    const handleEdit = async (e) => {
        e.preventDefault();
        try {
            const { data } = await api.patch(`/playlists/${editModal.id}/`, editForm);
            setPlaylists(prev => prev.map(p => p.id === editModal.id ? data : p));
            toast.success("Playlist updated.");
            setEditModal(null);
        } catch (err) {
            toast.error("Failed to update playlist.");
        }
    };

    const handleAddVideos = async (e) => {
        e.preventDefault();
        if (addVideoForm.video_ids.length === 0) return;
        try {
            const { data } = await api.post(`/playlists/${addVideoModal}/add-video/`, {
                video_ids: addVideoForm.video_ids
            });
            setPlaylists(prev => prev.map(p => p.id === addVideoModal ? data : p));
            toast.success("Videos added.");
            setAddVideoModal(null);
            setAddVideoForm({ video_ids: [] });
        } catch (err) {
            toast.error("Failed to add videos.");
        }
    };

    const handleDelete = async (id) => {
        if (!confirm("Delete this entire playlist? This affects any assigned devices.")) return;
        await api.delete(`/playlists/${id}/`);
        setPlaylists((prev) => prev.filter((p) => p.id !== id));
        toast.success("Playlist deleted.");
    };

    const removeVideoFromPlaylist = async (playlistId, videoIdToRemove) => {
        try {
            const { data } = await api.delete(`/playlists/${playlistId}/remove-video/${videoIdToRemove}/`);
            setPlaylists(prev => prev.map(p => p.id === playlistId ? data : p));
            toast.success("Video removed.");
        } catch (err) {
            toast.error("Failed to remove video.");
        }
    };

    const rotateVideoInPlaylist = async (playlistId, videoId) => {
        try {
            const { data } = await api.patch(`/videos/${videoId}/rotate/`);
            setPlaylists(prev => prev.map(p => {
                if (p.id === playlistId) {
                    const newVideos = p.videos.map(pv => pv.video.id === videoId ? { ...pv, video: data } : pv);
                    return { ...p, videos: newVideos };
                }
                return p;
            }));
        } catch (err) {
            toast.error("Failed to rotate video.");
        }
    };

    const handleDragEnd = async (event, playlistId) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const playlist = playlists.find(p => p.id === playlistId);
        const oldIndex = playlist.videos.findIndex(pv => pv.id === active.id);
        const newIndex = playlist.videos.findIndex(pv => pv.id === over.id);

        const newVideos = arrayMove(playlist.videos, oldIndex, newIndex);

        // Optimistic UI update
        const sortedPlaylist = { ...playlist, videos: newVideos };
        setPlaylists(prev => prev.map(p => p.id === playlistId ? sortedPlaylist : p));

        // Background sync
        try {
            const orderedUUIDs = newVideos.map(pv => pv.video.id);
            const { data } = await api.post(`/playlists/${playlistId}/reorder/`, {
                video_order: orderedUUIDs
            });
            setPlaylists(prev => prev.map(p => p.id === playlistId ? data : p));
        } catch (err) {
            toast.error("Failed to save reorder.");
            fetchPlaylists(); // rollback
        }
    };

    const toggleCreateVideo = (id) => {
        setCreateForm((f) => ({
            ...f,
            video_ids: f.video_ids.includes(id) ? f.video_ids.filter((v) => v !== id) : [...f.video_ids, id],
        }));
    };

    const toggleAddVideo = (id) => {
        setAddVideoForm((f) => ({
            ...f,
            video_ids: f.video_ids.includes(id) ? f.video_ids.filter((v) => v !== id) : [...f.video_ids, id],
        }));
    };

    const openEditModal = (pl) => {
        setEditForm({
            name: pl.name || "",
            description: pl.description || "",
            is_active: pl.is_active ?? true,
            loop_enabled: pl.loop_enabled ?? true,
            title_overlay: pl.title_overlay || "",
            autoplay: pl.autoplay ?? true,
        });
        setEditModal(pl);
    };

    return (
        <DashboardLayout title="Playlists">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <p className="text-text-secondary">{playlists.length} playlists</p>
                <button id="create-playlist-btn" onClick={() => setShowCreateModal(true)} className="btn-primary flex items-center gap-2 w-full sm:w-auto justify-center">
                    <Plus className="w-4 h-4" />Create Playlist
                </button>
            </div>

            <div className="space-y-4">
                {playlists.length === 0 && (
                    <div className="card p-12 text-center">
                        <ListVideo className="w-12 h-12 text-primary-border mx-auto mb-3" />
                        <p className="text-text-secondary">No playlists yet. Create one to assign to devices.</p>
                    </div>
                )}
                {playlists.map((pl) => (
                    <div key={pl.id} className="card overflow-hidden hover:border-accent-purple/30 transition-all duration-200">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4">
                            <div className="flex items-center gap-4 flex-1 min-w-0 w-full">
                                <div className="w-10 h-10 rounded-xl bg-accent-purple/10 border border-accent-purple/20 flex items-center justify-center shrink-0">
                                    <ListVideo className="w-5 h-5 text-accent-purple" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="font-semibold text-text-primary truncate">{pl.name}</p>
                                        {!pl.is_active && <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-status-offline/10 text-status-offline border border-status-offline/20">Inactive</span>}
                                    </div>
                                    <p className="text-xs text-text-muted mt-0.5">{pl.video_count} video{pl.video_count !== 1 ? "s" : ""} {pl.description ? `• ${pl.description}` : ""}</p>
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-2 shrink-0 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-primary-border sm:border-transparent mt-2 sm:mt-0">
                                <button onClick={() => setAddVideoModal(pl.id)} className="text-text-muted hover:text-accent-cyan p-2 transition-colors" title="Add Videos">
                                    <PlusCircle className="w-5 h-5 sm:w-4 sm:h-4" />
                                </button>
                                <button onClick={() => openEditModal(pl)} className="text-text-muted hover:text-accent-purple p-2 transition-colors" title="Edit Settings">
                                    <Settings className="w-5 h-5 sm:w-4 sm:h-4" />
                                </button>
                                <button onClick={() => handleDelete(pl.id)} className="text-text-muted hover:text-status-offline p-2 transition-colors" title="Delete Playlist">
                                    <Trash2 className="w-5 h-5 sm:w-4 sm:h-4" />
                                </button>
                                <button onClick={() => setExpanded(expanded === pl.id ? null : pl.id)} className="text-text-muted hover:text-text-primary p-2 transition-colors ml-2 border-l border-primary-border pl-4">
                                    {expanded === pl.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        {expanded === pl.id && (
                            <div className="border-t border-primary-border p-4 bg-primary-bg/30">
                                {pl.videos.length === 0 && <p className="text-text-muted text-sm text-center py-6">No videos in this playlist.</p>}

                                {pl.videos.length > 0 && (
                                    <DndContext
                                        sensors={sensors}
                                        collisionDetection={closestCenter}
                                        onDragEnd={(e) => handleDragEnd(e, pl.id)}
                                    >
                                        <SortableContext
                                            items={pl.videos.map(v => v.id)}
                                            strategy={verticalListSortingStrategy}
                                        >
                                            <div className="space-y-0 relative">
                                                {pl.videos.map((pv) => (
                                                    <SortableVideoItem
                                                        key={pv.id}
                                                        id={pv.id}
                                                        pv={pv}
                                                        onRemove={(videoId) => removeVideoFromPlaylist(pl.id, videoId)}
                                                        onRotate={(videoId) => rotateVideoInPlaylist(pl.id, videoId)}
                                                    />
                                                ))}
                                            </div>
                                        </SortableContext>
                                    </DndContext>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Create Modal */}
            {showCreateModal && (
                <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
                    <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold">Create Playlist</h2>
                            <button onClick={() => setShowCreateModal(false)}><X className="w-5 h-5 text-text-muted" /></button>
                        </div>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div>
                                <label className="block text-sm text-text-secondary mb-1.5">Playlist Name</label>
                                <input className="input-field" placeholder="Morning Lobby" value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} required />
                            </div>
                            <div>
                                <label className="block text-sm text-text-secondary mb-2">Select Initial Videos</label>
                                <div className="max-h-48 overflow-y-auto space-y-2 border border-primary-border rounded-xl p-2 bg-primary-bg">
                                    {videos.length === 0 && <p className="text-text-muted text-sm text-center py-4">No videos uploaded yet.</p>}
                                    {videos.map((v) => (
                                        <label key={v.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-primary-border/30 cursor-pointer">
                                            <input type="checkbox" checked={createForm.video_ids.includes(v.id)} onChange={() => toggleCreateVideo(v.id)} className="accent-accent-purple" />
                                            <span className="text-sm text-text-primary truncate flex-1">{v.title}</span>
                                        </label>
                                    ))}
                                </div>
                                <p className="text-xs text-text-muted mt-1">{createForm.video_ids.length} video(s) selected</p>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowCreateModal(false)} className="btn-secondary flex-1">Cancel</button>
                                <button type="submit" className="btn-primary flex-1">Create</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Playlist Settings Modal */}
            {editModal && (
                <div className="modal-overlay" onClick={() => setEditModal(null)}>
                    <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold">Playlist Settings</h2>
                            <button onClick={() => setEditModal(null)}><X className="w-5 h-5 text-text-muted" /></button>
                        </div>
                        <form onSubmit={handleEdit} className="space-y-4">
                            <div>
                                <label className="block text-sm text-text-secondary mb-1.5">Name</label>
                                <input className="input-field" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required />
                            </div>
                            <div>
                                <label className="block text-sm text-text-secondary mb-1.5">Description</label>
                                <input className="input-field" placeholder="Optional details..." value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm text-text-secondary mb-1.5">Title Overlay</label>
                                <input className="input-field" placeholder="e.g. Lunch Specials" value={editForm.title_overlay} onChange={(e) => setEditForm({ ...editForm, title_overlay: e.target.value })} />
                            </div>

                            <div className="space-y-3 pt-2 border-t border-primary-border">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input type="checkbox" checked={editForm.is_active} onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })} className="w-4 h-4 accent-accent-purple" />
                                    <span className="text-sm text-text-secondary">Playlist is Active</span>
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input type="checkbox" checked={editForm.loop_enabled} onChange={(e) => setEditForm({ ...editForm, loop_enabled: e.target.checked })} className="w-4 h-4 accent-accent-purple" />
                                    <span className="text-sm text-text-secondary">Loop playlist continuously</span>
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input type="checkbox" checked={editForm.autoplay} onChange={(e) => setEditForm({ ...editForm, autoplay: e.target.checked })} className="w-4 h-4 accent-accent-purple" />
                                    <span className="text-sm text-text-secondary">Auto-play videos on device</span>
                                </label>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button type="button" onClick={() => setEditModal(null)} className="btn-secondary flex-1">Cancel</button>
                                <button type="submit" className="btn-primary flex-1">Save Settings</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Add Videos Modal */}
            {addVideoModal && (
                <div className="modal-overlay" onClick={() => { setAddVideoModal(null); setAddVideoForm({ video_ids: [] }); }}>
                    <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold">Add Videos to Playlist</h2>
                            <button onClick={() => { setAddVideoModal(null); setAddVideoForm({ video_ids: [] }); }}><X className="w-5 h-5 text-text-muted" /></button>
                        </div>
                        <form onSubmit={handleAddVideos} className="space-y-4">
                            <div>
                                <div className="max-h-60 overflow-y-auto space-y-2 border border-primary-border rounded-xl p-2 bg-primary-bg">
                                    {videos.length === 0 && <p className="text-text-muted text-sm text-center py-4">No videos found.</p>}
                                    {videos.map((v) => (
                                        <label key={v.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-primary-border/30 cursor-pointer">
                                            <input type="checkbox" checked={addVideoForm.video_ids.includes(v.id)} onChange={() => toggleAddVideo(v.id)} className="accent-accent-purple" />
                                            <span className="text-sm text-text-primary truncate flex-1">{v.title}</span>
                                        </label>
                                    ))}
                                </div>
                                <p className="text-xs text-text-muted mt-2">{addVideoForm.video_ids.length} selected to add</p>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => { setAddVideoModal(null); setAddVideoForm({ video_ids: [] }); }} className="btn-secondary flex-1">Cancel</button>
                                <button type="submit" disabled={addVideoForm.video_ids.length === 0} className="btn-primary flex-1">Add Videos</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
}
