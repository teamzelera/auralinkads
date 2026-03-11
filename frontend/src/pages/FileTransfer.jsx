import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Send, CheckCircle, AlertCircle, Loader2, Film, Download } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import logo from "../images/logo.jpeg";
import { saveReceivedFile } from "../utils/localVideoDb";
import { getWsBase, resolveMediaUrl } from "../utils/backendUrls";
import DeviceSettingsButton from "../components/DeviceSettingsButton";

const PLAYER_API = import.meta.env.VITE_API_BASE || "http://localhost:8000/api";
const WS_BASE = import.meta.env.VITE_WS_BASE || "ws://localhost:8000";
const MAX_SIZE_BYTES = 200 * 1024 * 1024;
const ALLOWED_TYPES = ["video/mp4", "video/webm", "video/quicktime"];

export default function FileTransfer() {
    // Mode: "phone" (sending file) or "tv" (showing QR & waiting)
    const [mode, setMode] = useState("tv");
    
    // Shared
    const [deviceCode, setDeviceCode] = useState("");
    const wsRef = useRef(null);

    // ==== Phone Sender State ====
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState(null); // null | "sending" | "sent" | "error"
    const [error, setError] = useState("");
    const [dragging, setDragging] = useState(false);
    const fileInputRef = useRef();
    const xhrRef = useRef();

    // ==== TV Receiver State ====
    const [transferNotification, setTransferNotification] = useState(null);
    const transferQueueRef = useRef([]);
    const processingRef = useRef(false);

    // Initialization
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const urlCode = params.get("code");
        const localCode = localStorage.getItem("device_code");
        
        // If there's a code in the URL, act as Phone sender.
        // If no code in URL, act as TV receiver.
        if (urlCode !== null) {
            setMode("phone");
            setDeviceCode(urlCode.toUpperCase());
        } else {
            setMode("tv");
            setDeviceCode((localCode || "").toUpperCase());
        }
    }, []);

    // Cleanup preview URL
    useEffect(() => {
        return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
    }, [previewUrl]);

    // ==== TV Receiver Logic ====

    const navigate = useNavigate();

    const processQueue = useCallback(async () => {
        if (processingRef.current || transferQueueRef.current.length === 0) return;
        processingRef.current = true;

        while (transferQueueRef.current.length > 0) {
            const item = transferQueueRef.current[0];
            try {
                setTransferNotification(`Downloading: ${item.file_name}...`);

                // Resolve URL using shared utility — works in dev and production
                const downloadUrl = resolveMediaUrl(item.file_url);
                console.log("Downloading transfer from:", downloadUrl);

                const response = await fetch(downloadUrl);
                if (!response.ok) throw new Error("Download failed");

                const blob = await response.blob();
                console.log("Saving received file to IndexedDB:", item.file_name);
                await saveReceivedFile(blob, item.file_name, item.file_type);

                // Confirm to backend
                fetch(`${PLAYER_API}/device/transfer-confirm/`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ transfer_id: item.transfer_id }),
                }).catch(() => {});

                // Show success toast then redirect to file manager
                setTransferNotification(`✅ Received: ${item.file_name} — Opening File Manager...`);
                setTimeout(() => navigate("/device/files"), 1500);
            } catch (err) {
                console.error("Transfer download failed:", err);
                setTransferNotification(`✗ Failed: ${item.file_name}`);
                setTimeout(() => setTransferNotification(null), 4000);
            }
            transferQueueRef.current.shift();
        }

        processingRef.current = false;
    }, [navigate]);

    useEffect(() => {
        if (mode !== "tv" || !deviceCode) return;

        let ws;
        let retryTimeout;
        let destroyed = false;

        const connect = () => {
            if (destroyed) return;
            // Use VITE_WS_BASE (Render backend) — not window.location.host (Vercel frontend)
            const wsUrl = `${getWsBase()}/ws/device/${deviceCode}/transfer/`;
            console.log("Connecting transfer WS (TV view):", wsUrl);
            ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => console.log("Transfer WS connected on TV view:", deviceCode);

            ws.onclose = () => {
                if (!destroyed) {
                    console.warn("Transfer WS closed — retrying in 4s...");
                    retryTimeout = setTimeout(connect, 4000);
                }
            };

            ws.onerror = (e) => console.error("Transfer WS error:", e);

            ws.onmessage = (e) => {
                try {
                    const data = JSON.parse(e.data);
                    console.log("Transfer WS message:", data);

                    if (data.type === "transfer_started") {
                        setTransferNotification(`Incoming: ${data.file_name}`);
                    }

                    if (data.type === "file_transfer") {
                        transferQueueRef.current.push({
                            file_url: data.file_url,
                            file_name: data.file_name,
                            file_type: data.file_type,
                            file_size: data.file_size,
                            transfer_id: data.transfer_id,
                        });
                        processQueue();
                    }

                    if (data.type === "transfer_completed") {
                        setTransferNotification(`✓ Confirmed: ${data.file_name}`);
                        setTimeout(() => setTransferNotification(null), 3000);
                    }

                    if (data.type === "transfer_failed") {
                        setTransferNotification(`✗ Failed: ${data.file_name}`);
                        setTimeout(() => setTransferNotification(null), 4000);
                    }
                } catch (err) {
                    console.error("WS parse error:", err);
                }
            };
        };

        connect();

        return () => {
            destroyed = true;
            clearTimeout(retryTimeout);
            if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
        };
    }, [mode, deviceCode, processQueue]);


    // ==== Phone Sender Logic ====

    const validateAndSet = (file) => {
        setError("");
        setStatus(null);
        if (!ALLOWED_TYPES.includes(file.type)) {
            setError("Unsupported format. Use MP4, WebM, or QuickTime.");
            return;
        }
        if (file.size > MAX_SIZE_BYTES) {
            setError(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 200 MB.`);
            return;
        }
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setSelectedFile(file);
        setPreviewUrl(URL.createObjectURL(file));
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

    const handleSend = async () => {
        if (!selectedFile || !deviceCode) return;
        setUploading(true);
        setStatus("waking");
        setProgress(0);
        setError("");

        try {
            await fetch(`${PLAYER_API}/ping/`);
        } catch (err) {
            setStatus("connecting");
            try {
                await fetch(`${PLAYER_API}/ping/`);
            } catch (retryErr) {
                setUploading(false);
                setStatus("error");
                setError("Could not connect to server. Please try again.");
                return;
            }
        }

        setStatus("sending");

        const formData = new FormData();
        formData.append("device_code", deviceCode);
        formData.append("file", selectedFile);

        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;

        xhr.upload.addEventListener("progress", (e) => {
            if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        });

        xhr.addEventListener("load", () => {
            setUploading(false);
            if (xhr.status >= 200 && xhr.status < 300) {
                setStatus("sent");
                setProgress(100);
            } else {
                setStatus("error");
                try {
                    const data = JSON.parse(xhr.responseText);
                    setError(data.error || "Transfer failed.");
                } catch { setError("Transfer failed."); }
            }
        });

        xhr.addEventListener("error", () => {
            setUploading(false);
            setStatus("error");
            setError("Network error. Check your connection.");
        });

        xhr.open("POST", `${PLAYER_API}/device/send-file/`);
        xhr.send(formData);
    };

    const formatSize = (bytes) =>
        bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;


    // ==== Render ====

    return (
        <div className="min-h-screen bg-black text-white flex flex-col relative">
            {/* Header */}
            <div className="flex items-center gap-4 px-5 py-4 border-b border-gray-800 bg-gray-950">
                <button
                    onClick={() => {
                        if (mode === "phone") window.location.href = "/device/phone";
                        else window.location.href = "/device";
                    }}
                    className="w-9 h-9 rounded-xl bg-gray-800 hover:bg-gray-700 flex items-center justify-center transition-colors"
                >
                    <ArrowLeft className="w-5 h-5 text-gray-300" />
                </button>
                <div className="w-8 h-8 rounded-xl overflow-hidden bg-white">
                    <img src={logo} alt="AuraLink" className="w-full h-full object-contain" />
                </div>
                <div>
                    <h1 className="text-white font-semibold text-base leading-tight">
                        {mode === "phone" ? "Send File" : "AuraLink File Transfer"}
                    </h1>
                    <p className="text-gray-500 text-xs">
                        {mode === "phone" ? "Transfer video to TV" : "Waiting for files"}
                    </p>
                </div>
                <DeviceSettingsButton />
            </div>

            {/* TV Receiver UI */}
            {mode === "tv" && (
                <div className="flex-1 flex flex-col items-center justify-center p-8 relative">
                    <p className="text-gray-400 mb-2 uppercase tracking-widest text-xs font-semibold">Device Code</p>
                    <p className="text-3xl font-mono font-bold text-white tracking-widest mb-10">{deviceCode || "—"}</p>

                    <div className="bg-white p-4 rounded-3xl shadow-glow overflow-hidden mb-8">
                        {deviceCode ? (
                            <QRCodeSVG
                                value={`${window.location.origin}/device/transfer?code=${deviceCode}`}
                                size={220}
                                bgColor="#FFFFFF"
                                fgColor="#000000"
                            />
                        ) : (
                            <div className="w-[220px] h-[220px] bg-gray-200 animate-pulse flex items-center justify-center text-gray-400">
                                No Code
                            </div>
                        )}
                    </div>
                    
                    <p className="text-gray-400 text-center max-w-sm">
                        Scan this QR code with your phone to send a video.
                    </p>

                    {transferNotification && (
                        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-gray-900 border border-gray-700 rounded-2xl px-6 py-4 shadow-xl flex items-center gap-3 animate-fade-in">
                            <Download className="w-5 h-5 text-purple-400 animate-pulse" />
                            <p className="text-white text-sm font-medium whitespace-nowrap">{transferNotification}</p>
                        </div>
                    )}
                </div>
            )}

            {/* Phone Sender UI */}
            {mode === "phone" && !deviceCode && (
                <div className="flex-1 flex flex-col items-center justify-center p-5 text-center">
                    <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-8 max-w-sm w-full">
                        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                        <h2 className="text-white text-lg font-semibold mb-2">Invalid device link</h2>
                        <p className="text-red-300 text-sm">Please scan a valid QR code from your TV screen to send files.</p>
                    </div>
                </div>
            )}

            {mode === "phone" && deviceCode && (
                <div className="flex-1 overflow-y-auto p-5 space-y-5 max-w-xl mx-auto w-full">
                    
                    {/* Connected device */}
                    <div className="bg-gray-900 border border-gray-700 rounded-2xl px-4 py-3 flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                        <span className="text-gray-400 text-sm">Connected to</span>
                        <span className="text-white font-mono font-bold text-sm">{deviceCode}</span>
                    </div>

                    {/* Drop zone */}
                    <div
                        className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-200 cursor-pointer
                            ${dragging ? "border-purple-500 bg-purple-500/10" : "border-gray-700 hover:border-gray-500 bg-gray-900/50"}`}
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={handleDrop}
                    >
                        <input ref={fileInputRef} type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden" onChange={handleFileChange} />
                        <div className="w-14 h-14 rounded-2xl bg-gray-800 mx-auto flex items-center justify-center mb-4">
                            <Film className="w-7 h-7 text-gray-400" />
                        </div>
                        {selectedFile ? (
                            <div className="space-y-1">
                                <p className="text-white font-medium text-sm truncate max-w-xs mx-auto">{selectedFile.name}</p>
                                <p className="text-gray-500 text-xs">{formatSize(selectedFile.size)}</p>
                                <p className="text-purple-400 text-xs mt-2">Tap to choose different file</p>
                            </div>
                        ) : (
                            <div className="space-y-1">
                                <p className="text-gray-300 font-medium text-sm">Select a video file</p>
                                <p className="text-gray-600 text-xs">MP4, WebM, or QuickTime · Max 200 MB</p>
                            </div>
                        )}
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                            <p className="text-red-300 text-sm">{error}</p>
                        </div>
                    )}

                    {/* Preview */}
                    {previewUrl && (
                        <div className="rounded-2xl overflow-hidden bg-black border border-gray-800">
                            <video src={previewUrl} controls className="w-full" style={{ maxHeight: "200px" }} />
                        </div>
                    )}

                    {/* Progress */}
                    {uploading && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs text-gray-400">
                                <span className="flex items-center gap-1.5">
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    {status === "waking" ? "Waking server..." : status === "connecting" ? "Connecting to server..." : "Sending..."}
                                </span>
                                <span>{progress}%</span>
                            </div>
                            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-purple-600 to-cyan-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                            </div>
                        </div>
                    )}

                    {/* Success */}
                    {status === "sent" && (
                        <div className="flex items-center gap-2.5 bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3">
                            <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                            <p className="text-green-300 text-sm">File sent to TV! It will be downloaded and saved locally.</p>
                        </div>
                    )}

                    {/* Send button */}
                    {selectedFile && !uploading && status !== "sent" && (
                        <button
                            onClick={handleSend}
                            disabled={!deviceCode}
                            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-sm
                                bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400
                                disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 shadow-lg"
                        >
                            <Send className="w-4 h-4" />
                            Send to TV
                        </button>
                    )}

                    {/* Send another */}
                    {status === "sent" && (
                        <button
                            onClick={() => {
                                setSelectedFile(null);
                                if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }
                                setStatus(null);
                                setProgress(0);
                                if (fileInputRef.current) fileInputRef.current.value = "";
                            }}
                            className="w-full py-3.5 rounded-2xl text-sm text-gray-300 border border-gray-700 hover:border-gray-500 transition-colors"
                        >
                            Send another file
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
