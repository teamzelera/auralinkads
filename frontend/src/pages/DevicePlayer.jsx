import { useState, useEffect, useRef, useCallback } from "react";
import { Settings, X, LogOut, Trash2, Info, FileText, Mail, Upload, Send, FolderOpen, Clock, RotateCw } from "lucide-react";
import logo from "../images/logo.jpeg";
import { getLocalVideoUrl, saveReceivedFile, getPlaylistById, getReceivedFileUrl } from "../utils/localVideoDb";
import { getWsBase, resolveMediaUrl } from "../utils/backendUrls";

const PLAYER_API = import.meta.env.VITE_API_BASE || "http://localhost:8000/api";
const WS_BASE = import.meta.env.VITE_WS_BASE || "ws://localhost:8000";
const HEARTBEAT_INTERVAL = 30000;
const POLL_INTERVAL = 60000;

export default function DevicePlayer() {
    const [step, setStep] = useState("login"); // "login" | "playing"
    const [code, setCode] = useState("");
    const [deviceCode, setDeviceCode] = useState(localStorage.getItem("device_code") || "");
    const [deviceToken, setDeviceToken] = useState(localStorage.getItem("device_token") || "");
    const [assignment, setAssignment] = useState(null);
    const [currentVideoIdx, setCurrentVideoIdx] = useState(0);
    const [error, setError] = useState("");
    const [showSettings, setShowSettings] = useState(false);
    const [settingsMenu, setSettingsMenu] = useState(null);
    const [localVideoUrl, setLocalVideoUrl] = useState(null);

    // Transfer queue state
    const [transferNotification, setTransferNotification] = useState(null);
    const transferQueueRef = useRef([]);
    const processingRef = useRef(false);

    // IndexedDB active playlist
    const [activeIndexedPlaylist, setActiveIndexedPlaylist] = useState(null); // playlist object
    const [idxPlaylistIdx, setIdxPlaylistIdx] = useState(0);                   // current file index in it
    const [idxVideoUrl, setIdxVideoUrl] = useState(null);                      // blob URL for current file

    const [deviceRotation, setDeviceRotation] = useState(0);

    const videoRef = useRef();
    const heartbeatRef = useRef();
    const pollRef = useRef();
    const wsRef = useRef(null);

    const deviceFetch = async (path, options = {}) => {
        return fetch(`${PLAYER_API}${path}`, {
            headers: { "Authorization": `Device ${deviceToken}`, "Content-Type": "application/json" },
            ...options,
        });
    };

    // On mount: if we have a token, go to playing
    useEffect(() => {
        if (deviceToken) setStep("playing");
    }, []);

    // Mobile redirect: after login, if on a narrow screen redirect to phone dashboard
    useEffect(() => {
        if (step === "playing" && window.innerWidth < 768 && deviceCode) {
            window.location.href = "/device/phone";
        }
    }, [step]);

    // On mount: load local video and rotation from IndexedDB/localStorage
    useEffect(() => {
        getLocalVideoUrl()
            .then((url) => { if (url) setLocalVideoUrl(url); })
            .catch(() => {});
            
        const savedAngle = localStorage.getItem("device_rotation_angle");
        if (savedAngle !== null) {
            setDeviceRotation(Number(savedAngle));
        }

        // Load active IndexedDB playlist if one is set
        const activeId = localStorage.getItem("activePlaylistId");
        if (activeId) {
            getPlaylistById(Number(activeId))
                .then((pl) => { if (pl) setActiveIndexedPlaylist(pl); })
                .catch(() => {});
        }
    }, []);

    // Auto-open settings panel if navigated here with ?settings=1
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get("settings") === "1") {
            setShowSettings(true);
            setSettingsMenu("main");
            // Clean the query param from the URL without a reload
            window.history.replaceState({}, "", window.location.pathname);
        }
    }, []);

    // Reset video tracking when active assignment changes
    useEffect(() => {
        if (assignment?.id) setCurrentVideoIdx(0);
    }, [assignment?.id]);

    // Heartbeat
    useEffect(() => {
        if (step !== "playing") return;
        const sendHeartbeat = () =>
            deviceFetch("/devices/heartbeat/", {
                method: "POST",
                body: JSON.stringify({ status: "playing" }),
            }).catch(() => { });
        sendHeartbeat();
        heartbeatRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);
        return () => clearInterval(heartbeatRef.current);
    }, [step, deviceToken]);

    // Poll assignment
    useEffect(() => {
        if (step !== "playing") return;
        const pollAssignment = () =>
            deviceFetch("/device/get-playlist/")
                .then((r) => r.json())
                .then((data) => {
                    console.log("Device assignment fetched:", data);
                    if (data.error || data.assignment === null) setAssignment(null);
                    else setAssignment(data);
                })
                .catch((e) => console.error("Poll error:", e));
        pollAssignment();
        pollRef.current = setInterval(pollAssignment, POLL_INTERVAL);
        return () => clearInterval(pollRef.current);
    }, [step, deviceToken]);

    // ── Transfer Queue Processor ──────────────────────────

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

                setTransferNotification(`✓ Received: ${item.file_name}`);
                setTimeout(() => setTransferNotification(null), 4000);
            } catch (err) {
                console.error("Transfer download failed:", err);
                setTransferNotification(`✗ Failed: ${item.file_name}`);
                setTimeout(() => setTransferNotification(null), 4000);
            }
            transferQueueRef.current.shift();
        }

        processingRef.current = false;
    }, []);

    // ── WebSocket for File Transfers ──────────────────────

    useEffect(() => {
        if (step !== "playing" || !deviceCode) return;

        let ws;
        let retryTimeout;
        let destroyed = false;

        const connect = () => {
            if (destroyed) return;
            // Use VITE_WS_BASE (Render backend) — not window.location.host (Vercel frontend)
            const wsUrl = `${getWsBase()}/ws/device/${deviceCode}/transfer/`;
            console.log("Connecting transfer WS:", wsUrl);
            ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => console.log("Transfer WS connected:", deviceCode);

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
    }, [step, deviceCode, processQueue]);


    const handleLogin = async (e) => {
        e.preventDefault();
        setError("");
        try {
            const res = await fetch(`${PLAYER_API}/devices/authenticate/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ device_code: code.toUpperCase() }),
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error || "Authentication failed"); return; }
            localStorage.setItem("device_token", data.device_token);
            localStorage.setItem("device_code", code.toUpperCase());
            setDeviceToken(data.device_token);
            setDeviceCode(code.toUpperCase());
            setStep("playing");
        } catch {
            setError("Network error. Check connection.");
        }
    };

    const handleLogout = () => {
        localStorage.removeItem("device_token");
        localStorage.removeItem("device_code");
        setDeviceToken("");
        setDeviceCode("");
        setAssignment(null);
        setStep("login");
        setCode("");
        setShowSettings(false);
    };

    const handleDeleteDevice = async () => {
        if (!confirm("Delete this device? This cannot be undone.")) return;
        handleLogout();
    };

    // ── IndexedDB playlist file loader ──────────────────────
    useEffect(() => {
        if (!activeIndexedPlaylist) return;
        let revokeUrl;
        getReceivedFileUrl(activeIndexedPlaylist.files[idxPlaylistIdx].fileId)
            .then((url) => {
                setIdxVideoUrl(url);
                revokeUrl = url;
            })
            .catch(() => {});
        return () => { if (revokeUrl) URL.revokeObjectURL(revokeUrl); };
    }, [activeIndexedPlaylist, idxPlaylistIdx]);

    const isSingleVideo = !!assignment?.video;
    const videos = isSingleVideo
        ? [{ id: assignment.video.id, video: assignment.video }]
        : (assignment?.playlist?.videos || []);

    const onVideoEnded = () => {
        if (!assignment || videos.length === 0) return;
        if (videos.length > 1) {
            const next = (currentVideoIdx + 1) % videos.length;
            if (next === 0 && !(assignment?.loop_enabled && (isSingleVideo || assignment?.playlist?.loop_enabled))) {
                console.log("Playlist finished, loop disabled.");
                return;
            }
            setCurrentVideoIdx(next);
        }
    };

    const currentVideo = videos.length > 0 ? videos[currentVideoIdx] : null;
    const autoplayEnabled = isSingleVideo ? true : (assignment?.playlist?.autoplay ?? true);
    const titleOverlay = isSingleVideo ? "" : (assignment?.playlist?.title_overlay || "");

    // Force programmatic play whenever the video changes
    useEffect(() => {
        if (currentVideo && videoRef.current) {
            videoRef.current.load();
            videoRef.current.play().catch(e => console.warn("Autoplay rejected:", e));
        }
    }, [currentVideo?.id]);

    // Next video preload
    const nextVideoIdx = videos.length > 0 ? (currentVideoIdx + 1) % videos.length : null;
    const nextVideo = (nextVideoIdx !== null && (nextVideoIdx !== 0 || (assignment?.loop_enabled && (isSingleVideo || assignment?.playlist?.loop_enabled))))
        ? videos[nextVideoIdx]
        : null;

    // ── Login screen ──────────────────────────────────────
    if (step === "login") {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="text-center">
                    <div className="w-20 h-20 rounded-3xl mx-auto flex items-center justify-center mb-6 shadow-glow bg-white overflow-hidden">
                        <img src={logo} alt="AuraLink Logo" className="w-full h-full object-contain" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">AuraLink Display</h1>
                    <p className="text-gray-500 mb-8 text-sm">Enter device code to activate</p>
                    <form onSubmit={handleLogin} className="space-y-4 w-72 mx-auto">
                        <input
                            className="w-full bg-gray-900 border border-gray-700 text-white text-center text-xl font-mono tracking-widest rounded-2xl px-4 py-4 outline-none focus:border-accent-purple"
                            placeholder="AUR-XXXX"
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            maxLength={8}
                            autoFocus
                        />
                        {error && <p className="text-red-400 text-sm">{error}</p>}
                        <button type="submit" className="w-full bg-gradient-primary text-white font-bold py-4 rounded-2xl shadow-glow">
                            Activate Screen
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // ── Player screen ──────────────────────────────────────
    const renderRotatedVideo = () => (
        <div 
            className="w-full h-full flex items-center justify-center transition-transform duration-500 origin-center" 
            style={{ transform: `rotate(${deviceRotation}deg)` }}
        >
            {/*
              Priority:
              1) IndexedDB active playlist (set from LocalFileManager)
              2) Single local IndexedDB video (from LocalVideoUpload)
              3) Backend-assigned cloud playlist/video
              4) Waiting screen
            */}
            {activeIndexedPlaylist && idxVideoUrl ? (
                <>
                    <video
                        key={`idb-${idxPlaylistIdx}`}
                        className="w-full h-screen object-cover"
                        src={idxVideoUrl}
                        autoPlay muted playsInline preload="auto"
                        onEnded={() => setIdxPlaylistIdx((i) => (i + 1) % activeIndexedPlaylist.files.length)}
                        onError={() => setIdxPlaylistIdx((i) => (i + 1) % activeIndexedPlaylist.files.length)}
                    />
                    {/* Playlist name overlay */}
                    <div className="absolute bottom-6 left-6 pointer-events-none">
                        <span className="text-white/30 text-xs font-medium bg-black/30 px-3 py-1 rounded-full">
                            {activeIndexedPlaylist.name} · {idxPlaylistIdx + 1}/{activeIndexedPlaylist.files.length}
                        </span>
                    </div>
                </>
            ) : localVideoUrl ? (
                <video className="w-full h-screen object-cover" src={localVideoUrl} autoPlay loop muted playsInline preload="auto" />
            ) : currentVideo?.video?.cloudinary_url ? (
                <>
                    <video
                        ref={videoRef}
                        key={currentVideo.id}
                        className="w-full h-screen object-cover"
                        src={currentVideo.video.cloudinary_url}
                        autoPlay={autoplayEnabled}
                        loop={videos.length === 1 && assignment?.loop_enabled && (isSingleVideo || assignment?.playlist?.loop_enabled)}
                        muted playsInline preload="auto"
                        onEnded={onVideoEnded}
                        onError={(e) => { console.error("Playback error:", e); onVideoEnded(); }}
                        style={{ transform: `rotate(${currentVideo.video.rotation || 0}deg)` }}
                    />
                    {titleOverlay && (
                        <div className="absolute bottom-10 left-10 right-10 pointer-events-none">
                            <h2 className="text-white text-5xl font-bold drop-shadow-lg tracking-tight bg-black/40 inline-block px-6 py-3 rounded-2xl backdrop-blur-sm shadow-xl border border-white/10">
                                {titleOverlay}
                            </h2>
                        </div>
                    )}
                    {nextVideo?.video?.cloudinary_url && (
                        <video key={`preload-${nextVideo.id}`} preload="auto" className="hidden" muted playsInline src={nextVideo.video.cloudinary_url} />
                    )}
                </>
            ) : assignment ? (
                <div className="w-full h-screen flex flex-col items-center justify-center bg-black">
                    <p className="text-gray-600 text-lg">No playback media available for this device assignment.</p>
                </div>
            ) : (
                <div className="w-full h-screen flex flex-col items-center justify-center bg-black">
                    <div className="w-24 h-24 rounded-3xl flex items-center justify-center mb-6 shadow-glow animate-pulse-slow bg-white overflow-hidden">
                        <img src={logo} alt="AuraLink Logo" className="w-full h-full object-contain" />
                    </div>
                    <p className="text-gray-600 text-lg mb-6">Waiting for content...</p>

                    {/* Device Code */}
                    {deviceCode && (
                        <div className="text-center mt-4">
                            <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">Device Code</p>
                            <p className="text-white font-mono text-3xl font-bold tracking-widest">{deviceCode}</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );

    return (
        <div className="min-h-screen bg-black relative overflow-hidden">
            <div className="absolute inset-0 z-0">
                {renderRotatedVideo()}
            </div>

            {/* Transfer notification toast */}
            {transferNotification && (
                <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-gray-900 border border-gray-700 rounded-2xl px-5 py-3 shadow-xl z-50 animate-fade-in">
                    <p className="text-white text-sm font-medium whitespace-nowrap">{transferNotification}</p>
                </div>
            )}

            {/* Settings button */}
            <button
                onClick={() => { setShowSettings(true); setSettingsMenu("main"); }}
                className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-black/60 transition-all duration-200"
            >
                <Settings className="w-5 h-5" />
            </button>

            {/* Settings overlay */}
            {showSettings && (
                <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-end">
                    <div className="w-72 h-full bg-gray-950 border-l border-gray-800 flex flex-col">
                        <div className="flex items-center justify-between p-5 border-b border-gray-800">
                            <span className="font-semibold text-white">
                                {settingsMenu === "main" ? "Settings" : settingsMenu === "about" ? "About" : settingsMenu === "terms" ? "Terms" : "Contact"}
                            </span>
                            <button onClick={() => { if (settingsMenu !== "main") setSettingsMenu("main"); else setShowSettings(false); }}>
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>

                        {settingsMenu === "main" && (
                            <div className="flex-1 p-4 space-y-2">
                                {/* Section: File Transfer */}
                                <p className="text-gray-600 text-[10px] uppercase tracking-widest px-4 pt-2 pb-1">File Transfer</p>
                                {[
                                    { icon: Send, label: "Send / Receive Files", action: () => { setShowSettings(false); window.location.href = `/device/transfer`; }, color: "text-purple-300 hover:bg-purple-500/10" },
                                    { icon: FolderOpen, label: "Local File Manager", action: () => { setShowSettings(false); window.location.href = "/device/files"; }, color: "text-cyan-300 hover:bg-cyan-500/10" },
                                    { icon: Clock, label: "Transfer History", action: () => { setShowSettings(false); window.location.href = `/device/transfers?code=${deviceCode}`; }, color: "text-blue-300 hover:bg-blue-500/10" },
                                    { icon: RotateCw, label: "Display Rotation", action: () => { setShowSettings(false); window.location.href = "/device/display-rotation"; }, color: "text-pink-300 hover:bg-pink-500/10" },
                                ].map(({ icon: Icon, label, action, color }) => (
                                    <button key={label} onClick={action}
                                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors duration-200 ${color}`}>
                                        <Icon className="w-5 h-5" />
                                        <span className="font-medium text-sm">{label}</span>
                                    </button>
                                ))}

                                {/* Section: Media */}
                                <p className="text-gray-600 text-[10px] uppercase tracking-widest px-4 pt-4 pb-1">Media</p>
                                <button onClick={() => { setShowSettings(false); window.location.href = "/device/local-video"; }}
                                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors duration-200 text-purple-300 hover:bg-purple-500/10">
                                    <Upload className="w-5 h-5" />
                                    <span className="font-medium text-sm flex-1">Upload Local Video</span>
                                    {localVideoUrl && <span className="w-2 h-2 rounded-full bg-purple-400 flex-shrink-0" title="Active" />}
                                </button>

                                {/* Section: Device */}
                                <p className="text-gray-600 text-[10px] uppercase tracking-widest px-4 pt-4 pb-1">Device</p>
                                {[
                                    { icon: LogOut, label: "Logout", action: handleLogout, cls: "text-red-400 hover:bg-red-500/10" },
                                    { icon: Trash2, label: "Delete Device", action: handleDeleteDevice, cls: "text-red-400 hover:bg-red-500/10" },
                                    { icon: Info, label: "About", action: () => setSettingsMenu("about"), cls: "text-gray-300 hover:bg-gray-800" },
                                    { icon: FileText, label: "Terms of Service", action: () => setSettingsMenu("terms"), cls: "text-gray-300 hover:bg-gray-800" },
                                    { icon: Mail, label: "Contact", action: () => setSettingsMenu("contact"), cls: "text-gray-300 hover:bg-gray-800" },
                                ].map(({ icon: Icon, label, action, cls }) => (
                                    <button key={label} onClick={action}
                                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors duration-200 ${cls}`}>
                                        <Icon className="w-5 h-5" />
                                        <span className="font-medium text-sm">{label}</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {settingsMenu === "about" && (
                            <div className="flex-1 p-5 text-gray-400 text-sm space-y-3">
                                <p className="text-white font-semibold text-base">AuraLink Display v1.0</p>
                                <p>Digital Signage Management Platform — Device Player</p>
                                <p>This device is registered and managed by your organization's AuraLink admin.</p>
                                {deviceCode && (
                                    <div className="mt-4 bg-gray-900 rounded-xl p-3">
                                        <p className="text-gray-500 text-xs mb-1">Device Code</p>
                                        <p className="text-white font-mono text-lg tracking-wider">{deviceCode}</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {settingsMenu === "terms" && (
                            <div className="flex-1 p-5 text-gray-400 text-sm space-y-3 overflow-y-auto">
                                <p className="text-white font-semibold text-base">Terms of Service</p>
                                <p>This device is authorized for use as a display terminal within your organization.</p>
                                <p>Unauthorized use, modification, or access is prohibited.</p>
                            </div>
                        )}

                        {settingsMenu === "contact" && (
                            <div className="flex-1 p-5 text-gray-400 text-sm space-y-3">
                                <p className="text-white font-semibold text-base">Contact</p>
                                <p>For support, contact your AuraLink administrator.</p>
                                <p>AuraLink Digital Signage Platform</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
