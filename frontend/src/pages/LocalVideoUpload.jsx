import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Upload, Play, Trash2, Film, CheckCircle, AlertCircle } from "lucide-react";
import logo from "../images/logo.jpeg";
import { saveLocalVideo, getLocalVideoRecord, deleteLocalVideo } from "../utils/localVideoDb";
import DeviceSettingsButton from "../components/DeviceSettingsButton";

const PLAYER_API = import.meta.env.VITE_API_BASE || "http://localhost:8000/api";
const MAX_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB
const ALLOWED_TYPES = ["video/mp4", "video/webm"];

export default function LocalVideoUpload() {
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewUrl, setPreviewUrl]     = useState(null);
    const [existingRecord, setExistingRecord] = useState(null);
    const [existingUrl, setExistingUrl]   = useState(null);
    const [error, setError]               = useState("");
    const [success, setSuccess]           = useState("");
    const [saving, setSaving]             = useState(false);
    const [dragging, setDragging]         = useState(false);
    const fileInputRef = useRef();
    const previewRef   = useRef();

    // Load existing stored video on mount
    useEffect(() => {
        (async () => {
            const record = await getLocalVideoRecord().catch(() => null);
            if (record) {
                setExistingRecord(record);
                const url = URL.createObjectURL(record.file);
                setExistingUrl(url);
            }
        })();
    }, []);

    // Clean up object URLs on unmount
    useEffect(() => {
        return () => {
            if (previewUrl)  URL.revokeObjectURL(previewUrl);
            if (existingUrl) URL.revokeObjectURL(existingUrl);
        };
    }, [previewUrl, existingUrl]);

    const validateAndSet = (file) => {
        setError("");
        setSuccess("");
        if (!ALLOWED_TYPES.includes(file.type)) {
            setError("Unsupported format. Please select an MP4 or WebM video file.");
            return;
        }
        if (file.size > MAX_SIZE_BYTES) {
            setError(`File too large. Maximum size is 500 MB (selected: ${(file.size / 1024 / 1024).toFixed(1)} MB).`);
            return;
        }
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        const url = URL.createObjectURL(file);
        setSelectedFile(file);
        setPreviewUrl(url);
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) validateAndSet(file);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) validateAndSet(file);
    };

    const handleSave = async () => {
        if (!selectedFile) return;
        setSaving(true);
        setError("");
        try {
            await saveLocalVideo(selectedFile);

            // Report metadata to backend (best-effort, non-blocking)
            const deviceToken = localStorage.getItem("device_token") || "";
            fetch(`${PLAYER_API}/device/local-video/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    device_code: deviceToken ? "authenticated-device" : "unknown",
                    video_name: selectedFile.name,
                    type: "local",
                }),
            }).catch(() => {});

            setSuccess("Video saved! Returning to player…");
            setTimeout(() => { window.location.href = "/device"; }, 1200);
        } catch (err) {
            setError("Failed to save video. Please try again.");
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm("Remove the stored local video?")) return;
        await deleteLocalVideo().catch(() => {});
        setExistingRecord(null);
        if (existingUrl) { URL.revokeObjectURL(existingUrl); setExistingUrl(null); }
        setSelectedFile(null);
        if (previewUrl)  { URL.revokeObjectURL(previewUrl);  setPreviewUrl(null); }
        setSuccess("Local video deleted.");
    };

    const formatSize = (bytes) =>
        bytes < 1024 * 1024
            ? `${(bytes / 1024).toFixed(0)} KB`
            : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

    const formatDate = (ts) =>
        new Date(ts).toLocaleString(undefined, {
            month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
        });

    return (
        <div className="min-h-screen bg-black text-white flex flex-col">
            {/* Header */}
            <div className="flex items-center gap-4 px-5 py-4 border-b border-gray-800 bg-gray-950">
                <button
                    onClick={() => window.location.href = "/device"}
                    className="w-9 h-9 rounded-xl bg-gray-800 hover:bg-gray-700 flex items-center justify-center transition-colors"
                    title="Back to player"
                >
                    <ArrowLeft className="w-5 h-5 text-gray-300" />
                </button>
                <div className="w-8 h-8 rounded-xl overflow-hidden bg-white">
                    <img src={logo} alt="AuraLink" className="w-full h-full object-contain" />
                </div>
                <div>
                    <h1 className="text-white font-semibold text-base leading-tight">Local Video</h1>
                    <p className="text-gray-500 text-xs">Upload from device storage</p>
                </div>
                <DeviceSettingsButton />
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5 max-w-xl mx-auto w-full">

                {/* Existing stored video card */}
                {existingRecord && (
                    <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Film className="w-4 h-4 text-purple-400" />
                                <span className="text-sm font-medium text-white">Currently Playing</span>
                            </div>
                            <button
                                onClick={handleDelete}
                                className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-400/50 px-2.5 py-1.5 rounded-lg transition-colors"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete
                            </button>
                        </div>
                        <p className="text-gray-300 text-sm font-mono truncate">{existingRecord.name}</p>
                        <p className="text-gray-600 text-xs">
                            Saved {formatDate(existingRecord.savedAt)} · {formatSize(existingRecord.file.size)}
                        </p>
                        <video
                            src={existingUrl}
                            controls
                            className="w-full rounded-xl bg-black"
                            style={{ maxHeight: "200px" }}
                        />
                    </div>
                )}

                {/* Drop zone / File picker */}
                <div
                    className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-200 cursor-pointer
                        ${dragging
                            ? "border-purple-500 bg-purple-500/10"
                            : "border-gray-700 hover:border-gray-500 bg-gray-900/50"
                        }`}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={handleDrop}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="video/mp4,video/webm"
                        className="hidden"
                        onChange={handleFileChange}
                    />
                    <div className="w-14 h-14 rounded-2xl bg-gray-800 mx-auto flex items-center justify-center mb-4">
                        <Upload className="w-7 h-7 text-gray-400" />
                    </div>
                    {selectedFile ? (
                        <div className="space-y-1">
                            <p className="text-white font-medium text-sm truncate max-w-xs mx-auto">{selectedFile.name}</p>
                            <p className="text-gray-500 text-xs">{formatSize(selectedFile.size)}</p>
                            <p className="text-purple-400 text-xs mt-2">Click to choose a different file</p>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            <p className="text-gray-300 font-medium text-sm">
                                {existingRecord ? "Replace video" : "Select a video file"}
                            </p>
                            <p className="text-gray-600 text-xs">MP4 or WebM · Max 500 MB</p>
                            <p className="text-gray-700 text-xs mt-2">Click or drag & drop</p>
                        </div>
                    )}
                </div>

                {/* Error / success messages */}
                {error && (
                    <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                        <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                        <p className="text-red-300 text-sm">{error}</p>
                    </div>
                )}
                {success && (
                    <div className="flex items-center gap-2.5 bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3">
                        <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                        <p className="text-green-300 text-sm">{success}</p>
                    </div>
                )}

                {/* Preview player */}
                {previewUrl && (
                    <div className="space-y-3">
                        <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">Preview</p>
                        <div className="rounded-2xl overflow-hidden bg-black border border-gray-800">
                            <video
                                ref={previewRef}
                                src={previewUrl}
                                controls
                                autoPlay
                                className="w-full"
                                style={{ maxHeight: "280px" }}
                            />
                        </div>
                    </div>
                )}

                {/* Action buttons */}
                {selectedFile && (
                    <div className="flex gap-3 pt-1 pb-6">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-sm
                                bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400
                                disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 shadow-lg"
                        >
                            <Play className="w-4 h-4" />
                            {saving ? "Saving…" : "Save & Play"}
                        </button>
                        <button
                            onClick={() => {
                                setSelectedFile(null);
                                if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }
                                setError("");
                                if (fileInputRef.current) fileInputRef.current.value = "";
                            }}
                            className="px-5 py-3.5 rounded-2xl text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
