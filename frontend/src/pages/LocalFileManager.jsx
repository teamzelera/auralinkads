import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
    ArrowLeft, Play, Trash2, Film, HardDrive, CheckSquare, Square,
    Plus, X, ChevronUp, ChevronDown, ListVideo, Tv, Edit2,
    Zap, ZapOff, List, LayoutGrid,
} from "lucide-react";
import logo from "../images/logo.jpeg";
import {
    getAllReceivedFiles,
    getReceivedFileUrl,
    deleteReceivedFile,
    savePlaylist,
    getAllPlaylists,
    getPlaylistById,
    updatePlaylist,
    deletePlaylist,
    activatePlaylist,
    deactivatePlaylist,
} from "../utils/localVideoDb";
import DeviceSettingsButton from "../components/DeviceSettingsButton";

// ── Helpers ─────────────────────────────────────────────────
const formatSize = (bytes = 0) =>
    bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const formatDate = (ts) =>
    ts ? new Date(ts).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

// ── Inline Fullscreen Player ─────────────────────────────────
function InlinePlayer({ files, startIdx = 0, onClose }) {
    const [idx, setIdx] = useState(startIdx);
    const [url, setUrl] = useState(null);
    const videoRef = useRef();
    const rotation = Number(localStorage.getItem("device_rotation_angle") || 0);

    useEffect(() => {
        let revoke;
        getReceivedFileUrl(files[idx].fileId).then((u) => {
            setUrl(u);
            revoke = u;
        });
        return () => { if (revoke) URL.revokeObjectURL(revoke); };
    }, [idx, files]);

    useEffect(() => {
        if (url && videoRef.current) {
            videoRef.current.load();
            videoRef.current.play().catch(() => {});
        }
    }, [url]);

    const next = () => setIdx((i) => (i + 1) % files.length);

    return (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
            {/* Top bar */}
            <div className="flex items-center justify-between px-4 py-3 bg-black/80 backdrop-blur-sm border-b border-gray-800">
                <span className="text-white text-sm font-medium truncate max-w-xs">
                    {files[idx].name}
                    {files.length > 1 && <span className="text-gray-500 ml-2">({idx + 1}/{files.length})</span>}
                </span>
                <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center transition-colors">
                    <X className="w-4 h-4 text-gray-300" />
                </button>
            </div>

            {/* Video */}
            <div className="flex-1 flex items-center justify-center overflow-hidden bg-black">
                {url ? (
                    <video
                        ref={videoRef}
                        src={url}
                        className="max-w-full max-h-full"
                        style={{ transform: `rotate(${rotation}deg)`, transition: "transform 0.3s" }}
                        controls
                        autoPlay
                        onEnded={files.length > 1 ? next : undefined}
                        playsInline
                    />
                ) : (
                    <div className="w-10 h-10 border-2 border-gray-600 border-t-purple-500 rounded-full animate-spin" />
                )}
            </div>

            {/* Bottom nav for playlists */}
            {files.length > 1 && (
                <div className="flex items-center justify-center gap-4 px-4 py-3 bg-black/80 border-t border-gray-800">
                    <button onClick={() => setIdx((i) => (i - 1 + files.length) % files.length)}
                        className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 transition-colors">
                        ‹ Prev
                    </button>
                    <span className="text-gray-500 text-xs">{idx + 1} / {files.length}</span>
                    <button onClick={next}
                        className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 transition-colors">
                        Next ›
                    </button>
                </div>
            )}
        </div>
    );
}

// ── Create / Edit Playlist Modal ────────────────────────────
function PlaylistModal({ selectedFiles, existingPlaylist, onSave, onClose }) {
    const [name, setName] = useState(existingPlaylist?.name || "");
    const [orderedFiles, setOrderedFiles] = useState(
        existingPlaylist?.files || selectedFiles.map((f) => ({ fileId: f.id, name: f.file_name, size: f.file_size }))
    );
    const [saving, setSaving] = useState(false);

    const moveUp = (i) => {
        if (i === 0) return;
        const arr = [...orderedFiles];
        [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
        setOrderedFiles(arr);
    };
    const moveDown = (i) => {
        if (i === orderedFiles.length - 1) return;
        const arr = [...orderedFiles];
        [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
        setOrderedFiles(arr);
    };
    const removeFile = (i) => setOrderedFiles((arr) => arr.filter((_, idx) => idx !== i));

    const handleSave = async () => {
        if (!name.trim()) return;
        setSaving(true);
        await onSave(name.trim(), orderedFiles);
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 flex items-end sm:items-center justify-center p-4">
            <div className="bg-gray-950 border border-gray-800 rounded-2xl w-full max-w-md flex flex-col max-h-[85vh]">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-gray-800">
                    <h2 className="text-white font-semibold">{existingPlaylist ? "Edit Playlist" : "New Playlist"}</h2>
                    <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center">
                        <X className="w-4 h-4 text-gray-300" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    {/* Name input */}
                    <div>
                        <label className="block text-xs text-gray-500 mb-1.5 uppercase tracking-wider">Playlist Name</label>
                        <input
                            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:border-purple-500 outline-none transition-colors"
                            placeholder="e.g. Lobby Loop"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            autoFocus
                        />
                    </div>

                    {/* File order */}
                    <div>
                        <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider">File Order ({orderedFiles.length})</p>
                        {orderedFiles.length === 0 ? (
                            <p className="text-gray-600 text-sm text-center py-4">No files in playlist</p>
                        ) : (
                            <div className="space-y-2">
                                {orderedFiles.map((f, i) => (
                                    <div key={f.fileId} className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-xl px-3 py-2">
                                        <span className="text-gray-600 text-xs font-mono w-5 text-center">{i + 1}</span>
                                        <Film className="w-4 h-4 text-gray-500 flex-shrink-0" />
                                        <span className="flex-1 text-sm text-white truncate">{f.name}</span>
                                        <div className="flex flex-col gap-0.5">
                                            <button onClick={() => moveUp(i)} className="w-5 h-5 flex items-center justify-center hover:text-white text-gray-600 transition-colors">
                                                <ChevronUp className="w-3.5 h-3.5" />
                                            </button>
                                            <button onClick={() => moveDown(i)} className="w-5 h-5 flex items-center justify-center hover:text-white text-gray-600 transition-colors">
                                                <ChevronDown className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                        <button onClick={() => removeFile(i)} className="w-6 h-6 flex items-center justify-center text-gray-600 hover:text-red-400 transition-colors">
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-gray-800 flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 rounded-xl text-sm text-gray-400 border border-gray-700 hover:border-gray-500 transition-colors">
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!name.trim() || saving || orderedFiles.length === 0}
                        className="flex-1 py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                        {saving ? "Saving..." : "Save Playlist"}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Main Page ────────────────────────────────────────────────
export default function LocalFileManager() {
    const navigate = useNavigate();

    // Tab
    const [tab, setTab] = useState("files"); // "files" | "playlists"

    // Files tab state
    const [files, setFiles] = useState([]);
    const [selected, setSelected] = useState(new Set());

    // Playlists tab state
    const [playlists, setPlaylists] = useState([]);
    const [activePlaylistId, setActivePlaylistId] = useState(
        () => Number(localStorage.getItem("activePlaylistId")) || null
    );

    // Modals
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingPlaylist, setEditingPlaylist] = useState(null); // playlist object to edit

    // Inline player
    const [playerFiles, setPlayerFiles] = useState(null); // null = closed; array = playing

    // Load data
    const loadFiles = useCallback(async () => {
        const all = await getAllReceivedFiles().catch(() => []);
        all.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
        setFiles(all);
    }, []);

    const loadPlaylists = useCallback(async () => {
        const all = await getAllPlaylists().catch(() => []);
        all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setPlaylists(all);
    }, []);

    useEffect(() => { loadFiles(); loadPlaylists(); }, [loadFiles, loadPlaylists]);

    // ── Selection helpers ──
    const toggleSelect = (id) => setSelected((prev) => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
    });
    const toggleSelectAll = () => {
        if (selected.size === files.length) setSelected(new Set());
        else setSelected(new Set(files.map((f) => f.id)));
    };
    const selectedFiles = files.filter((f) => selected.has(f.id));

    // ── File actions ──
    const handleDeleteFile = async (id) => {
        if (!confirm("Delete this file from local storage?")) return;
        await deleteReceivedFile(id).catch(() => {});
        setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; });
        loadFiles();
    };

    const handleDeleteSelected = async () => {
        if (!confirm(`Delete ${selected.size} file(s)?`)) return;
        await Promise.all([...selected].map((id) => deleteReceivedFile(id).catch(() => {})));
        setSelected(new Set());
        loadFiles();
    };

    const handlePlayFile = (file) => setPlayerFiles([{ fileId: file.id, name: file.file_name }]);
    const handlePlaySelected = () => setPlayerFiles(selectedFiles.map((f) => ({ fileId: f.id, name: f.file_name })));

    // ── Playlist actions ──
    const handleSavePlaylist = async (name, orderedFiles) => {
        await savePlaylist(name, orderedFiles);
        setShowCreateModal(false);
        setSelected(new Set());
        loadPlaylists();
        setTab("playlists");
    };

    const handleUpdatePlaylist = async (name, orderedFiles) => {
        await updatePlaylist(editingPlaylist.id, name, orderedFiles);
        setEditingPlaylist(null);
        loadPlaylists();
    };

    const handleDeletePlaylist = async (id) => {
        if (!confirm("Delete this playlist?")) return;
        await deletePlaylist(id);
        if (activePlaylistId === id) setActivePlaylistId(null);
        loadPlaylists();
    };

    const handlePlayPlaylist = (pl) => setPlayerFiles(pl.files);

    const handleActivatePlaylist = (pl) => {
        activatePlaylist(pl.id);
        setActivePlaylistId(pl.id);
        navigate("/device");
    };

    const handleDeactivate = () => {
        deactivatePlaylist();
        setActivePlaylistId(null);
    };

    // ── Render files tab ──
    const renderFilesTab = () => (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Select all bar */}
            {files.length > 0 && (
                <div className="flex items-center gap-3 px-5 py-2.5 bg-gray-900/50 border-b border-gray-800/50">
                    <button onClick={toggleSelectAll} className="flex items-center gap-2 text-xs text-gray-400 hover:text-white transition-colors">
                        {selected.size === files.length
                            ? <CheckSquare className="w-4 h-4 text-purple-400" />
                            : <Square className="w-4 h-4" />
                        }
                        {selected.size === files.length ? "Deselect All" : "Select All"}
                    </button>
                    {selected.size > 0 && (
                        <span className="text-xs text-purple-400 ml-auto">{selected.size} selected</span>
                    )}
                </div>
            )}

            {/* File list */}
            <div className="flex-1 overflow-y-auto">
                {files.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full py-20 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-gray-900 flex items-center justify-center mb-4">
                            <HardDrive className="w-8 h-8 text-gray-600" />
                        </div>
                        <p className="text-gray-500 text-sm">No files stored locally</p>
                        <p className="text-gray-700 text-xs mt-1">Files received from phone will appear here</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-800/50">
                        {files.map((f) => (
                            <div
                                key={f.id}
                                className={`flex items-center gap-3 px-5 py-3.5 transition-colors ${selected.has(f.id) ? "bg-purple-500/10" : "hover:bg-gray-900/50"}`}
                            >
                                {/* Checkbox */}
                                <button onClick={() => toggleSelect(f.id)} className="flex-shrink-0">
                                    {selected.has(f.id)
                                        ? <CheckSquare className="w-5 h-5 text-purple-400" />
                                        : <Square className="w-5 h-5 text-gray-600 hover:text-gray-400" />
                                    }
                                </button>

                                {/* File icon */}
                                <div className="w-9 h-9 rounded-xl bg-gray-800 flex items-center justify-center flex-shrink-0">
                                    <Film className="w-4 h-4 text-gray-400" />
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <p className="text-white text-sm font-medium truncate">{f.file_name}</p>
                                    <p className="text-gray-600 text-xs">{formatSize(f.file_size)} · {formatDate(f.created_at)}</p>
                                </div>

                                {/* Actions */}
                                <button onClick={() => handlePlayFile(f)} className="w-8 h-8 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 flex items-center justify-center transition-colors flex-shrink-0">
                                    <Play className="w-4 h-4 text-purple-300" />
                                </button>
                                <button onClick={() => handleDeleteFile(f.id)} className="w-8 h-8 rounded-lg bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center transition-colors flex-shrink-0">
                                    <Trash2 className="w-4 h-4 text-red-400" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Bottom action bar — visible when files are selected */}
            {selected.size > 0 && (
                <div className="border-t border-gray-800 bg-gray-950 px-4 py-3 flex gap-2 flex-wrap">
                    <button
                        onClick={handlePlaySelected}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium bg-purple-600 hover:bg-purple-500 text-white transition-colors"
                    >
                        <Play className="w-4 h-4" /> Play Selected
                    </button>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium bg-cyan-600 hover:bg-cyan-500 text-white transition-colors"
                    >
                        <Plus className="w-4 h-4" /> Add to Playlist
                    </button>
                    <button
                        onClick={handleDeleteSelected}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium bg-red-600/80 hover:bg-red-600 text-white transition-colors ml-auto"
                    >
                        <Trash2 className="w-4 h-4" /> Delete
                    </button>
                </div>
            )}
        </div>
    );

    // ── Render playlists tab ──
    const renderPlaylistsTab = () => (
        <div className="flex-1 overflow-y-auto">
            {playlists.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-gray-900 flex items-center justify-center mb-4">
                        <ListVideo className="w-8 h-8 text-gray-600" />
                    </div>
                    <p className="text-gray-500 text-sm">No playlists yet</p>
                    <p className="text-gray-700 text-xs mt-1">Select files and tap "Add to Playlist"</p>
                </div>
            ) : (
                <div className="divide-y divide-gray-800/50">
                    {playlists.map((pl) => {
                        const isActive = activePlaylistId === pl.id;
                        return (
                            <div key={pl.id} className={`px-5 py-4 transition-colors ${isActive ? "bg-green-500/5 border-l-2 border-green-500" : "hover:bg-gray-900/50"}`}>
                                <div className="flex items-start gap-3">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isActive ? "bg-green-500/20" : "bg-gray-800"}`}>
                                        <ListVideo className={`w-5 h-5 ${isActive ? "text-green-400" : "text-gray-400"}`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="text-white font-medium text-sm truncate">{pl.name}</p>
                                            {isActive && (
                                                <span className="flex-shrink-0 text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-medium">Active</span>
                                            )}
                                        </div>
                                        <p className="text-gray-600 text-xs mt-0.5">
                                            {pl.files.length} file{pl.files.length !== 1 ? "s" : ""} · {formatDate(new Date(pl.createdAt).getTime())}
                                        </p>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex gap-2 mt-3 flex-wrap">
                                    <button
                                        onClick={() => handlePlayPlaylist(pl)}
                                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 transition-colors"
                                    >
                                        <Play className="w-3.5 h-3.5" /> Play
                                    </button>
                                    {isActive ? (
                                        <button
                                            onClick={handleDeactivate}
                                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-green-500/10 hover:bg-red-500/10 text-green-400 hover:text-red-400 transition-colors"
                                        >
                                            <ZapOff className="w-3.5 h-3.5" /> Deactivate
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => handleActivatePlaylist(pl)}
                                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-green-500/10 hover:bg-green-500/20 text-green-400 transition-colors"
                                        >
                                            <Zap className="w-3.5 h-3.5" /> Activate
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setEditingPlaylist(pl)}
                                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors"
                                    >
                                        <Edit2 className="w-3.5 h-3.5" /> Edit
                                    </button>
                                    <button
                                        onClick={() => handleDeletePlaylist(pl.id)}
                                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" /> Delete
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );

    return (
        <div className="min-h-screen bg-black text-white flex flex-col">
            {/* Header */}
            <div className="flex items-center gap-4 px-5 py-4 border-b border-gray-800 bg-gray-950">
                <button
                    onClick={() => navigate("/device")}
                    className="w-9 h-9 rounded-xl bg-gray-800 hover:bg-gray-700 flex items-center justify-center transition-colors"
                >
                    <ArrowLeft className="w-5 h-5 text-gray-300" />
                </button>
                <div className="w-8 h-8 rounded-xl overflow-hidden bg-white">
                    <img src={logo} alt="AuraLink" className="w-full h-full object-contain" />
                </div>
                <div>
                    <h1 className="text-white font-semibold text-base leading-tight">Local Files</h1>
                    <p className="text-gray-500 text-xs">{files.length} file{files.length !== 1 ? "s" : ""} · {playlists.length} playlist{playlists.length !== 1 ? "s" : ""}</p>
                </div>
                <DeviceSettingsButton />
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-800 bg-gray-950">
                <button
                    onClick={() => setTab("files")}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors border-b-2 ${tab === "files" ? "text-white border-purple-500" : "text-gray-500 border-transparent hover:text-gray-300"}`}
                >
                    <LayoutGrid className="w-4 h-4" /> Files
                </button>
                <button
                    onClick={() => setTab("playlists")}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors border-b-2 ${tab === "playlists" ? "text-white border-purple-500" : "text-gray-500 border-transparent hover:text-gray-300"}`}
                >
                    <ListVideo className="w-4 h-4" /> Playlists
                    {playlists.length > 0 && (
                        <span className="ml-1 w-5 h-5 rounded-full bg-purple-500/30 text-purple-300 text-xs flex items-center justify-center">{playlists.length}</span>
                    )}
                </button>
            </div>

            {/* Tab content */}
            {tab === "files" ? renderFilesTab() : renderPlaylistsTab()}

            {/* Playlist creation modal */}
            {showCreateModal && (
                <PlaylistModal
                    selectedFiles={selectedFiles}
                    onSave={handleSavePlaylist}
                    onClose={() => setShowCreateModal(false)}
                />
            )}

            {/* Playlist edit modal */}
            {editingPlaylist && (
                <PlaylistModal
                    selectedFiles={[]}
                    existingPlaylist={editingPlaylist}
                    onSave={handleUpdatePlaylist}
                    onClose={() => setEditingPlaylist(null)}
                />
            )}

            {/* Inline player */}
            {playerFiles && (
                <InlinePlayer
                    files={playerFiles}
                    onClose={() => setPlayerFiles(null)}
                />
            )}
        </div>
    );
}
