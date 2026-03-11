import { useState, useEffect } from "react";
import DashboardLayout from "../components/layout/DashboardLayout";
import api from "../api/axios";
import { Monitor, Plus, Trash2, Copy, Check, RefreshCw, Film } from "lucide-react";
import toast from "react-hot-toast";
import { formatDistanceToNow } from "../utils/helpers";

export default function Devices() {
    const [devices, setDevices] = useState([]);
    const [playlists, setPlaylists] = useState([]);
    const [videos, setVideos] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState({ name: "", location: "" });
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(null);
    const [assignModal, setAssignModal] = useState(null); // device to assign
    const [assignForm, setAssignForm] = useState({ type: "playlist", id: "", loop_enabled: true });

    useEffect(() => {
        fetchDevices();
        api.get("/playlists/").then((r) => setPlaylists(r.data));
        api.get("/videos/").then((r) => setVideos(r.data));
    }, []);

    const fetchDevices = async () => {
        const { data } = await api.get("/devices/");
        setDevices(data);
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const { data } = await api.post("/devices/generate-code/", form);
            setDevices((prev) => [data, ...prev]);
            toast.success(`Device created! Code: ${data.device_code}`);
            setShowModal(false);
            setForm({ name: "", location: "" });
        } catch (err) {
            toast.error("Failed to create device.");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm("Delete this device?")) return;
        await api.delete(`/devices/${id}/`);
        setDevices((prev) => prev.filter((d) => d.id !== id));
        toast.success("Device deleted.");
    };

    const handleRestart = async (id) => {
        await api.post(`/devices/${id}/restart/`);
        toast.success("Restart signal sent.");
    };

    const copyCode = (code, id) => {
        navigator.clipboard.writeText(code);
        setCopied(id);
        setTimeout(() => setCopied(null), 2000);
        toast.success("Code copied!");
    };

    const handleAssign = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                device_id: assignModal.id,
                loop_enabled: assignForm.loop_enabled,
            };
            if (assignForm.type === "playlist") {
                payload.playlist_id = assignForm.id || null;
            } else {
                payload.video_id = assignForm.id || null;
            }
            const { data } = await api.post("/playlists/assignments/", payload);
            if (data.status === "already_assigned") {
                toast.error("This content is already assigned and active on this device.");
            } else {
                toast.success("Assigned successfully!");
                setAssignModal(null);
                fetchDevices();
            }
        } catch (err) {
            toast.error("Failed to assign content");
        }
    };

    return (
        <DashboardLayout title="Devices">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <p className="text-text-secondary">{devices.length} devices registered</p>
                <button id="add-device-btn" onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2 w-full sm:w-auto justify-center">
                    <Plus className="w-4 h-4" />Add Device
                </button>
            </div>

            <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-primary-bg/50">
                            <tr>
                                {["Device", "Code", "Location", "Assigned Content", "Status", "Last Seen", "Actions"].map((h) => (
                                    <th key={h} className="table-header">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {devices.length === 0 && (
                                <tr><td colSpan={7} className="text-center text-text-muted py-16 text-sm">No devices yet. Create one to get started.</td></tr>
                            )}
                            {devices.map((d) => (
                                <tr key={d.id} className="table-row">
                                    <td className="table-cell">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-primary-bg border border-primary-border flex items-center justify-center">
                                                <Monitor className="w-4 h-4 text-text-muted" />
                                            </div>
                                            <span className="font-medium text-text-primary">{d.name}</span>
                                        </div>
                                    </td>
                                    <td className="table-cell">
                                        <div className="flex items-center gap-2">
                                            <code className="text-accent-cyan font-mono text-sm bg-accent-cyan/10 px-2 py-0.5 rounded">{d.device_code}</code>
                                            <button onClick={() => copyCode(d.device_code, d.id)} className="text-text-muted hover:text-accent-cyan transition-colors">
                                                {copied === d.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                            </button>
                                        </div>
                                    </td>
                                    <td className="table-cell">{d.location || "—"}</td>
                                    <td className="table-cell">
                                        {d.active_content ? (
                                            <span className="text-text-primary px-2 py-1 rounded bg-accent-purple/10 border border-accent-purple/20 text-xs font-medium">
                                                {d.active_content}
                                            </span>
                                        ) : (
                                            <span className="text-text-muted text-sm">—</span>
                                        )}
                                    </td>
                                    <td className="table-cell">
                                        <div className="flex items-center gap-2">
                                            <span className={`status-dot ${d.status === "online" ? "bg-status-online animate-pulse" : "bg-status-offline"}`} />
                                            <span className={d.status === "online" ? "badge-online" : "badge-offline"}>{d.status}</span>
                                        </div>
                                    </td>
                                    <td className="table-cell text-text-muted">{d.last_seen ? formatDistanceToNow(d.last_seen) : "Never"}</td>
                                    <td className="table-cell">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <button onClick={() => { setAssignModal(d); setAssignForm({ type: "playlist", id: "", loop_enabled: true }); }}
                                                className="text-xs text-accent-purple hover:text-accent-purple-hover font-medium px-2 py-1 rounded bg-accent-purple/10 hover:bg-accent-purple/20 transition-colors whitespace-nowrap">
                                                Assign
                                            </button>
                                            <button onClick={() => handleRestart(d.id)} className="text-text-muted hover:text-accent-cyan p-1.5 transition-colors" title="Remote Restart">
                                                <RefreshCw className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => handleDelete(d.id)} className="text-text-muted hover:text-status-offline p-1.5 transition-colors">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add Device Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h2 className="text-lg font-semibold text-text-primary mb-4">Register New Device</h2>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div>
                                <label className="block text-sm text-text-secondary mb-1.5">Device Name</label>
                                <input className="input-field" placeholder="Reception Screen" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                            </div>
                            <div>
                                <label className="block text-sm text-text-secondary mb-1.5">Location</label>
                                <input className="input-field" placeholder="Lobby, Floor 1" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
                                <button type="submit" disabled={loading} className="btn-primary flex-1">
                                    {loading ? "Creating..." : "Generate Code"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Assign Content Modal */}
            {assignModal && (
                <div className="modal-overlay" onClick={() => setAssignModal(null)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h2 className="text-lg font-semibold text-text-primary mb-1">Assign Content</h2>
                        <p className="text-text-muted text-sm mb-4">to <span className="text-accent-cyan">{assignModal.name}</span></p>
                        <form onSubmit={handleAssign} className="space-y-4">
                            <div className="flex gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="radio" name="type" value="playlist" checked={assignForm.type === "playlist"} onChange={(e) => setAssignForm({ ...assignForm, type: e.target.value, id: "" })} className="accent-accent-purple" />
                                    <span className="text-sm text-text-secondary">Playlist</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="radio" name="type" value="video" checked={assignForm.type === "video"} onChange={(e) => setAssignForm({ ...assignForm, type: e.target.value, id: "" })} className="accent-accent-purple" />
                                    <span className="text-sm text-text-secondary">Single Video</span>
                                </label>
                            </div>
                            <div>
                                {assignForm.type === "playlist" ? (
                                    <select className="input-field" value={assignForm.id} onChange={(e) => setAssignForm({ ...assignForm, id: e.target.value })}>
                                        <option value="">— Select Playlist —</option>
                                        {playlists.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                ) : (
                                    <select className="input-field" value={assignForm.id} onChange={(e) => setAssignForm({ ...assignForm, id: e.target.value })}>
                                        <option value="">— Select Video —</option>
                                        {videos.map((v) => <option key={v.id} value={v.id}>{v.title}</option>)}
                                    </select>
                                )}
                            </div>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" checked={assignForm.loop_enabled} onChange={(e) => setAssignForm({ ...assignForm, loop_enabled: e.target.checked })} className="w-4 h-4 accent-accent-purple" />
                                <span className="text-sm text-text-secondary">Loop content continuously</span>
                            </label>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setAssignModal(null)} className="btn-secondary flex-1">Cancel</button>
                                <button type="submit" className="btn-primary flex-1">Assign</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
}
