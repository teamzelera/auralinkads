import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Play, Trash2, Film, HardDrive } from "lucide-react";
import logo from "../images/logo.jpeg";
import { getAllReceivedFiles, getReceivedFileUrl, deleteReceivedFile } from "../utils/localVideoDb";
import DeviceSettingsButton from "../components/DeviceSettingsButton";

export default function LocalFileManager() {
    const [files, setFiles] = useState([]);
    const [playingId, setPlayingId] = useState(null);
    const [playingUrl, setPlayingUrl] = useState(null);
    const videoRef = useRef();

    const loadFiles = async () => {
        const all = await getAllReceivedFiles().catch(() => []);
        // Sort newest first
        all.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
        setFiles(all);
    };

    useEffect(() => { loadFiles(); }, []);

    useEffect(() => {
        return () => { if (playingUrl) URL.revokeObjectURL(playingUrl); };
    }, [playingUrl]);

    const handlePlay = async (id) => {
        if (playingUrl) URL.revokeObjectURL(playingUrl);
        const url = await getReceivedFileUrl(id);
        if (url) {
            setPlayingId(id);
            setPlayingUrl(url);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm("Delete this file from local storage?")) return;
        await deleteReceivedFile(id);
        if (playingId === id) {
            if (playingUrl) URL.revokeObjectURL(playingUrl);
            setPlayingId(null);
            setPlayingUrl(null);
        }
        loadFiles();
    };

    const formatSize = (bytes) =>
        bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    const formatDate = (ts) =>
        ts ? new Date(ts).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

    return (
        <div className="min-h-screen bg-black text-white flex flex-col">
            {/* Header */}
            <div className="flex items-center gap-4 px-5 py-4 border-b border-gray-800 bg-gray-950">
                <button
                    onClick={() => window.location.href = "/device"}
                    className="w-9 h-9 rounded-xl bg-gray-800 hover:bg-gray-700 flex items-center justify-center transition-colors"
                >
                    <ArrowLeft className="w-5 h-5 text-gray-300" />
                </button>
                <div className="w-8 h-8 rounded-xl overflow-hidden bg-white">
                    <img src={logo} alt="AuraLink" className="w-full h-full object-contain" />
                </div>
                <div>
                    <h1 className="text-white font-semibold text-base leading-tight">Local Files</h1>
                    <p className="text-gray-500 text-xs">{files.length} file{files.length !== 1 ? "s" : ""} stored</p>
                </div>
                <DeviceSettingsButton />
            </div>

            {/* Player */}
            {playingUrl && (
                <div className="border-b border-gray-800">
                    <video ref={videoRef} src={playingUrl} controls autoPlay className="w-full" style={{ maxHeight: "280px" }} />
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
                            <div key={f.id} className={`flex items-center gap-3 px-5 py-3.5 transition-colors ${playingId === f.id ? "bg-purple-500/10" : "hover:bg-gray-900/50"}`}>
                                <div className="w-9 h-9 rounded-xl bg-gray-800 flex items-center justify-center flex-shrink-0">
                                    <Film className="w-4 h-4 text-gray-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-white text-sm font-medium truncate">{f.file_name}</p>
                                    <p className="text-gray-600 text-xs">{formatSize(f.file_size || 0)} · {formatDate(f.created_at)}</p>
                                </div>
                                <button onClick={() => handlePlay(f.id)} className="w-8 h-8 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 flex items-center justify-center transition-colors">
                                    <Play className="w-4 h-4 text-purple-300" />
                                </button>
                                <button onClick={() => handleDelete(f.id)} className="w-8 h-8 rounded-lg bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center transition-colors">
                                    <Trash2 className="w-4 h-4 text-red-400" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
