import { useEffect, useState, useRef } from "react";
import logo from "../images/logo.jpeg";
import DashboardLayout from "../components/layout/DashboardLayout";
import api from "../api/axios";
import { Monitor, Wifi, WifiOff, Film, ListVideo, Zap, Activity } from "lucide-react";
import { formatDistanceToNow } from "../utils/helpers";

const WS_URL = import.meta.env.VITE_WS_BASE || "ws://localhost:8000";

export default function Dashboard() {
    const [stats, setStats] = useState(null);
    const [devices, setDevices] = useState([]);
    const wsRef = useRef(null);

    const fetchData = async () => {
        const [statsRes, devicesRes] = await Promise.all([
            api.get("/analytics/dashboard/"),
            api.get("/devices/"),
        ]);
        setStats(statsRes.data);
        setDevices(devicesRes.data);
    };

    useEffect(() => {
        fetchData();

        // WebSocket for live device status
        const ws = new WebSocket(`${WS_URL}/ws/devices/status/`);
        wsRef.current = ws;
        ws.onmessage = (e) => {
            const msg = JSON.parse(e.data);
            if (msg.type === "device_status") {
                setDevices((prev) =>
                    prev.map((d) =>
                        d.id === msg.device_id
                            ? { ...d, status: msg.status, last_seen: msg.last_seen }
                            : d
                    )
                );
                setStats((prev) => {
                    if (!prev) return prev;
                    const online = msg.status === "online" ? prev.online_devices + 1 : Math.max(0, prev.online_devices - 1);
                    return { ...prev, online_devices: online, offline_devices: prev.total_devices - online };
                });
            }
        };
        return () => ws.close();
    }, []);

    const statCards = stats ? [
        { label: "Total Screens", value: stats.total_devices, icon: Monitor, color: "text-accent-purple", bg: "bg-accent-purple/10" },
        { label: "Online", value: stats.online_devices, icon: Wifi, color: "text-status-online", bg: "bg-status-online/10" },
        { label: "Offline", value: stats.offline_devices, icon: WifiOff, color: "text-status-offline", bg: "bg-status-offline/10" },
        { label: "Videos", value: stats.total_videos, icon: Film, color: "text-accent-cyan", bg: "bg-accent-cyan/10" },
        { label: "Playlists", value: stats.total_playlists, icon: ListVideo, color: "text-status-idle", bg: "bg-status-idle/10" },
        { label: "Active Assignments", value: stats.active_assignments, icon: Zap, color: "text-accent-purple", bg: "bg-accent-purple/10" },
    ] : [];

    return (
        <DashboardLayout title="Dashboard">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
                {statCards.map(({ label, value, icon: Icon, color, bg }) => (
                    <div key={label} className="stat-card">
                        <div className={`inline-flex p-2.5 rounded-xl ${bg} mb-3`}>
                            <Icon className={`w-5 h-5 ${color}`} />
                        </div>
                        <p className="text-2xl font-bold text-text-primary">{value}</p>
                        <p className="text-xs text-text-secondary mt-0.5">{label}</p>
                    </div>
                ))}
                {!stats && Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="stat-card animate-pulse">
                        <div className="w-10 h-10 bg-primary-border rounded-xl mb-3" />
                        <div className="h-7 bg-primary-border rounded w-12 mb-1" />
                        <div className="h-3 bg-primary-border rounded w-20" />
                    </div>
                ))}
            </div>

            {/* Devices Table */}
            <div className="card overflow-hidden">
                <div className="flex items-center justify-between p-5 border-b border-primary-border">
                    <div className="flex items-center gap-2">
                        <Activity className="w-5 h-5 text-accent-purple" />
                        <h2 className="font-semibold text-text-primary">Device Status</h2>
                    </div>
                    <span className="text-text-muted text-sm">{devices.length} devices</span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-primary-bg/50">
                            <tr>
                                {["Device", "Location", "Status", "Last Seen"].map((h) => (
                                    <th key={h} className="table-header">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {devices.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="text-center text-text-muted py-12 text-sm">
                                        No devices registered yet.
                                    </td>
                                </tr>
                            )}
                            {devices.map((d) => (
                                <tr key={d.id} className="table-row">
                                    <td className="table-cell">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-primary-bg border border-primary-border flex items-center justify-center">
                                                <Monitor className="w-4 h-4 text-text-muted" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-text-primary">{d.name}</p>
                                                <p className="text-xs text-text-muted font-mono">{d.device_code}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="table-cell">{d.location || "—"}</td>
                                    <td className="table-cell">
                                        <div className="flex items-center gap-2">
                                            <span className={`status-dot ${d.status === "online" ? "bg-status-online animate-pulse" : "bg-status-offline"}`} />
                                            <span className={d.status === "online" ? "badge-online" : "badge-offline"}>
                                                {d.status}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="table-cell text-text-muted">
                                        {d.last_seen ? formatDistanceToNow(d.last_seen) : "Never"}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </DashboardLayout>
    );
}
