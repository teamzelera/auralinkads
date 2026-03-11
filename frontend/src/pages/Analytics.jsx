import { useState, useEffect } from "react";
import DashboardLayout from "../components/layout/DashboardLayout";
import api from "../api/axios";
import { BarChart2, Activity, Wifi, WifiOff, Clock } from "lucide-react";
import { formatDistanceToNow } from "../utils/helpers";

export default function Analytics() {
    const [uptime, setUptime] = useState([]);
    const [stats, setStats] = useState(null);

    useEffect(() => {
        api.get("/analytics/dashboard/").then((r) => setStats(r.data));
        api.get("/analytics/uptime/").then((r) => setUptime(r.data));
    }, []);

    return (
        <DashboardLayout title="Analytics">
            {/* Overview */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    {[
                        { label: "Total Devices", value: stats.total_devices, color: "text-accent-purple" },
                        { label: "Online Now", value: stats.online_devices, color: "text-status-online" },
                        { label: "Active Assignments", value: stats.active_assignments, color: "text-accent-cyan" },
                        { label: "Total Videos", value: stats.total_videos, color: "text-status-idle" },
                    ].map(({ label, value, color }) => (
                        <div key={label} className="stat-card text-center">
                            <p className={`text-3xl font-bold ${color} mb-1`}>{value}</p>
                            <p className="text-text-secondary text-sm">{label}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Device Uptime */}
            <div className="card overflow-hidden">
                <div className="flex items-center gap-2 p-5 border-b border-primary-border">
                    <Activity className="w-5 h-5 text-accent-purple" />
                    <h2 className="font-semibold text-text-primary">Device Uptime (Last 24h)</h2>
                </div>
                <div className="p-4 space-y-4">
                    {uptime.length === 0 && (
                        <p className="text-text-muted text-center py-8 text-sm">No devices registered yet.</p>
                    )}
                    {uptime.map((d) => (
                        <div key={d.device_id} className="space-y-2">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="flex items-center gap-3 truncate">
                                    <span className={`status-dot shrink-0 ${d.status === "online" ? "bg-status-online" : "bg-status-offline"}`} />
                                    <span className="text-sm font-medium text-text-primary truncate">{d.device_name}</span>
                                    <span className={`shrink-0 ${d.status === "online" ? "badge-online" : "badge-offline"}`}>{d.status}</span>
                                </div>
                                <div className="flex items-center gap-4 text-xs text-text-muted shrink-0">
                                    <span className="flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {d.last_seen ? formatDistanceToNow(d.last_seen) : "Never seen"}
                                    </span>
                                    <span className="font-semibold text-text-primary">{d.uptime_pct_24h}%</span>
                                </div>
                            </div>
                            {/* Progress bar */}
                            <div className="h-2 bg-primary-border rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-accent-purple to-accent-cyan rounded-full transition-all duration-700"
                                    style={{ width: `${d.uptime_pct_24h}%` }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </DashboardLayout>
    );
}
