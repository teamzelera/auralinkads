import { useState, useEffect, useRef } from "react";
import DashboardLayout from "../components/layout/DashboardLayout";
import api from "../api/axios";
import { Film, Upload, Trash2, Play, Clock, Loader2, X, Monitor, RotateCw } from "lucide-react";
import toast from "react-hot-toast";
import { formatDuration } from "../utils/helpers";

export default function Videos() {
    const [videos, setVideos] = useState([]);
    const [devices, setDevices] = useState([]);
    const [showUpload, setShowUpload] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadForm, setUploadForm] = useState({ title: "", cloudinary_url: "", thumbnail: "", duration: 0 });
    const [dragOver, setDragOver] = useState(false);
    const [assignModal, setAssignModal] = useState(null);
    const [deleteModal, setDeleteModal] = useState(null);
    const fileInputRef = useRef();

    useEffect(() => {
        fetchVideos();
        api.get("/devices/").then((r) => setDevices(r.data));
    }, []);

    const fetchVideos = async () => {
        const { data } = await api.get("/videos/");
        setVideos(data);
    };

    const handleFileUpload = async (file) => {
        if (!file) return;
        setUploading(true);
        try {
            const fd = new FormData();
            fd.append("file", file);
            fd.append("title", file.name.replace(/\.[^.]+$/, ""));

            const { data: video } = await api.post("/admin/upload-video/", fd, {
                headers: { "Content-Type": "multipart/form-data" }
            });

            setVideos((prev) => [video, ...prev]);
            toast.success("Video uploaded successfully!");
        } catch (err) {
            console.error(err);
            toast.error("Upload failed: " + (err.message || "Unknown error"));
        } finally {
            setUploading(false);
        }
    };

    const handleManualSubmit = async (e) => {
        e.preventDefault();
        const { data } = await api.post("/videos/", uploadForm);
        setVideos((prev) => [data, ...prev]);
        toast.success("Video registered!");
        setShowUpload(false);
        setUploadForm({ title: "", cloudinary_url: "", thumbnail: "", duration: 0 });
    };

    const handleDelete = async (id) => {
        try {
            await api.delete(`/videos/${id}/`);
            setVideos((prev) => prev.filter((v) => v.id !== id));
            toast.success("Video deleted.");
            setDeleteModal(null);
        } catch (err) {
            toast.error("Failed to delete video: " + (err.response?.data?.error || err.message));
        }
    };

    const handleRotate = async (id) => {
        try {
            const { data } = await api.patch(`/videos/${id}/rotate/`);
            setVideos((prev) => prev.map((v) => (v.id === id ? data : v)));
            toast.success("Video rotated.");
        } catch (err) {
            toast.error("Failed to rotate video.");
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith("video/")) handleFileUpload(file);
        else toast.error("Please drop a video file.");
    };

    const handleAssignVideo = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const device_id = formData.get("device_id");
        const loop_enabled = formData.get("loop") === "on";

        try {
            const { data } = await api.post("/playlists/assignments/", {
                device_id,
                video_id: assignModal.id,
                loop_enabled,
            });
            if (data.status === "already_assigned") {
                toast.error("This video is already assigned and active on this device.");
            } else {
                toast.success("Assigned successfully!");
                setAssignModal(null);
            }
        } catch (err) {
            toast.error("Failed to assign video");
        }
    };

    return (
        <DashboardLayout title="Videos">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <p className="text-text-secondary">{videos.length} videos in library</p>
                <div className="flex w-full sm:w-auto gap-3">
                    <button id="upload-file-btn" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="btn-secondary flex-1 sm:flex-none flex items-center justify-center gap-2">
                        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        {uploading ? "Uploading..." : "Upload File"}
                    </button>
                    <button id="add-url-btn" onClick={() => setShowUpload(true)} className="btn-primary flex-1 sm:flex-none flex items-center justify-center gap-2">
                        <Film className="w-4 h-4" />Add URL
                    </button>
                </div>
            </div>

            <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={(e) => handleFileUpload(e.target.files[0])} />

            {/* Drop zone */}
            <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer mb-6 transition-all duration-200
          ${dragOver ? "border-accent-purple bg-accent-purple/10" : "border-primary-border hover:border-accent-purple/50 hover:bg-primary-card"}`}
            >
                <Upload className="w-8 h-8 text-text-muted mx-auto mb-2" />
                <p className="text-text-secondary font-medium">Drag & drop video files here</p>
                <p className="text-text-muted text-sm mt-1">or click to browse • Uploaded to Cloudinary CDN</p>
            </div>

            {/* Video Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {videos.map((v) => (
                    <div key={v.id} className="card overflow-hidden group hover:border-accent-purple/30 transition-all duration-300">
                        <div className="relative aspect-video bg-primary-bg flex items-center justify-center overflow-hidden">
                            {v.cloudinary_url ? (
                                <video controls preload="metadata" className="w-full h-full object-cover" style={{ transform: `rotate(${v.rotation || 0}deg)` }}>
                                    <source src={v.cloudinary_url} type="video/mp4" />
                                </video>
                            ) : v.thumbnail ? (
                                <img src={v.thumbnail} alt={v.title} className="w-full h-full object-cover" style={{ transform: `rotate(${v.rotation || 0}deg)` }} />
                            ) : (
                                <Film className="w-10 h-10 text-primary-border" />
                            )}
                            {!v.cloudinary_url && (
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                                    <Play className="w-8 h-8 text-white" />
                                </div>
                            )}
                        </div>
                        <div className="p-3">
                            <p className="font-medium text-text-primary text-sm truncate">{v.title}</p>
                            <div className="flex items-center justify-between mt-1.5">
                                <div className="flex items-center gap-1 text-text-muted text-xs">
                                    <Clock className="w-3 h-3" />
                                    <span>{formatDuration(v.duration)}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => handleRotate(v.id)} className="text-text-muted hover:text-accent-purple transition-colors p-1 bg-primary-bg rounded-md" title="Rotate Video">
                                        <RotateCw className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => setAssignModal(v)} className="text-text-muted hover:text-accent-cyan transition-colors p-1 bg-primary-bg rounded-md" title="Assign to Device">
                                        <Monitor className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => setDeleteModal(v)} className="text-text-muted hover:text-status-offline transition-colors p-1 bg-primary-bg rounded-md" title="Delete Video">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Manual URL modal */}
            {showUpload && (
                <div className="modal-overlay" onClick={() => setShowUpload(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold">Register Video URL</h2>
                            <button onClick={() => setShowUpload(false)}><X className="w-5 h-5 text-text-muted" /></button>
                        </div>
                        <form onSubmit={handleManualSubmit} className="space-y-4">
                            <div><label className="block text-sm text-text-secondary mb-1.5">Title</label>
                                <input className="input-field" placeholder="My Video" value={uploadForm.title} onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })} required /></div>
                            <div><label className="block text-sm text-text-secondary mb-1.5">Cloudinary URL</label>
                                <input className="input-field" placeholder="https://res.cloudinary.com/..." value={uploadForm.cloudinary_url} onChange={(e) => setUploadForm({ ...uploadForm, cloudinary_url: e.target.value })} required /></div>
                            <div><label className="block text-sm text-text-secondary mb-1.5">Thumbnail URL (optional)</label>
                                <input className="input-field" placeholder="https://..." value={uploadForm.thumbnail} onChange={(e) => setUploadForm({ ...uploadForm, thumbnail: e.target.value })} /></div>
                            <div><label className="block text-sm text-text-secondary mb-1.5">Duration (seconds)</label>
                                <input type="number" className="input-field" placeholder="120" value={uploadForm.duration} onChange={(e) => setUploadForm({ ...uploadForm, duration: parseFloat(e.target.value) || 0 })} /></div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowUpload(false)} className="btn-secondary flex-1">Cancel</button>
                                <button type="submit" className="btn-primary flex-1">Register</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Assign Video to Device Modal */}
            {assignModal && (
                <div className="modal-overlay" onClick={() => setAssignModal(null)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h2 className="text-lg font-semibold text-text-primary mb-1">Assign to Device</h2>
                        <p className="text-text-muted text-sm mb-4">Video: <span className="text-accent-cyan">{assignModal.title}</span></p>
                        <form onSubmit={handleAssignVideo} className="space-y-4">
                            <div>
                                <label className="block text-sm text-text-secondary mb-1.5">Select Device</label>
                                <select className="input-field" name="device_id" required defaultValue="">
                                    <option value="" disabled>— Select Device —</option>
                                    {devices.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.device_code})</option>)}
                                </select>
                            </div>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" name="loop" defaultChecked className="w-4 h-4 accent-accent-purple" />
                                <span className="text-sm text-text-secondary">Loop video continuously</span>
                            </label>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setAssignModal(null)} className="btn-secondary flex-1">Cancel</button>
                                <button type="submit" className="btn-primary flex-1">Assign</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Delete Modal */}
            {deleteModal && (
                <div className="modal-overlay" onClick={() => setDeleteModal(null)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="text-lg font-semibold text-status-offline flex items-center gap-2">
                                <Trash2 className="w-5 h-5" />
                                Delete Video
                            </h2>
                            <button onClick={() => setDeleteModal(null)}><X className="w-5 h-5 text-text-muted" /></button>
                        </div>
                        <p className="text-text-secondary text-sm mb-6">
                            Are you sure you want to permanently delete <strong>{deleteModal.title}</strong>? This action cannot be undone and will break any playlists assigning this video.
                        </p>
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteModal(null)} className="btn-secondary flex-1">Cancel</button>
                            <button onClick={() => handleDelete(deleteModal.id)} className="bg-status-offline hover:bg-red-600 text-white font-medium py-2 px-4 rounded-lg flex-1 transition-colors">Confirm Deletion</button>
                        </div>
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
}
